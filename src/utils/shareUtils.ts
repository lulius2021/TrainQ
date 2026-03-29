import html2canvas from 'html2canvas';

export const captureAndShare = async (elementId: string, fileName: string = 'trainq-stats.png') => {
    const element = document.getElementById(elementId);
    if (!element) throw new Error("Export-Element nicht gefunden");

    try {
        // Resolve computed background color from the element
        const computedBg = getComputedStyle(element).backgroundColor;
        const bgColor = computedBg && computedBg !== "rgba(0, 0, 0, 0)" ? computedBg : "#18181b";

        // 1. Capture Canvas (High Res & CORS enabled)
        const canvas = await html2canvas(element, {
            useCORS: true,
            scale: 2,
            backgroundColor: bgColor,
            logging: false,
        });

        // 2. Convert to Blob
        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/png', 1.0)
        );
        if (!blob) throw new Error("Bild konnte nicht generiert werden");

        // 3. Create File Object
        const file = new File([blob], fileName, { type: 'image/png' });

        // 4. Native Share (Mobile)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'TrainQ Export',
                text: 'Mein Fortschritt auf TrainQ 🔥',
            });
        } else {
            // 5. Fallback Download (Desktop)
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            link.click();
        }
    } catch (error: any) {
        if (import.meta.env.DEV) console.error("Export Failed:", error);
        alert("Teilen fehlgeschlagen: " + error.message);
    }
};
