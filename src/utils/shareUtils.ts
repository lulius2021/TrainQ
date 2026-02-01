import html2canvas from 'html2canvas';

export const captureAndShare = async (elementId: string, fileName: string = 'trainq-stats.png') => {
    const element = document.getElementById(elementId);
    if (!element) throw new Error("Export-Element nicht gefunden");

    try {
        // 1. Capture Canvas (High Res & CORS enabled)
        const canvas = await html2canvas(element, {
            useCORS: true, // WICHTIG für Profilbilder/Thumbnails
            scale: 2, // Retina Qualität
            backgroundColor: '#18181b', // Hex für zinc-900 (Hintergrund erzwingen)
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
        console.error("Export Failed:", error);
        alert("Teilen fehlgeschlagen: " + error.message);
    }
};
