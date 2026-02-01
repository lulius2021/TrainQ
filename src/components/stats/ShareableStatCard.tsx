import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { AppButton } from "../ui/AppButton";

interface ShareableStatCardProps {
    children: React.ReactNode;
    titleForFile?: string;
    onShareSuccess?: () => void;
}

export const ShareableStatCard: React.FC<ShareableStatCardProps> = ({
    children,
    titleForFile = "stats",
    onShareSuccess,
}) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isSharing, setIsSharing] = useState(false);

    const handleShare = async () => {
        if (!cardRef.current) return;
        setIsSharing(true);

        try {
            // 1. Temporarily add watermark if needed (via CSS class or just trust the capture)
            // We'll rely on a hidden element becoming visible or just rendering it into the canvas if we want.
            // But simpler: just capture the card as is. The user asked for a watermark "TrainQ" bottom right.

            // Let's modify the node temporarily or clone it. 
            // html2canvas allows onclone.

            const canvas = await html2canvas(cardRef.current, {
                useCORS: true,
                scale: 2, // better quality
                backgroundColor: "#1C1C1E", // match card bg
                onclone: (clonedDoc, element) => {
                    // Inject watermark to cloned element
                    const watermark = clonedDoc.createElement("div");
                    watermark.textContent = "TrainQ";
                    watermark.style.position = "absolute";
                    watermark.style.bottom = "12px";
                    watermark.style.right = "12px";
                    watermark.style.color = "rgba(255, 255, 255, 0.4)";
                    watermark.style.fontSize = "14px";
                    watermark.style.fontWeight = "bold";
                    watermark.style.fontFamily = "sans-serif";
                    watermark.style.zIndex = "1000";
                    watermark.style.pointerEvents = "none";
                    element.appendChild(watermark);

                    // Ensure transparency works if needed, but we set backgroundColor
                }
            });

            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
            if (!blob) throw new Error("Blob creation failed");

            const file = new File([blob], `${titleForFile}.png`, { type: "image/png" });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: "Mein Training auf TrainQ",
                    text: "Check mein Training auf TrainQ!",
                });
                onShareSuccess?.();
            } else {
                // Fallback: Download
                const link = document.createElement('a');
                link.download = `${titleForFile}.png`;
                link.href = canvas.toDataURL();
                link.click();
                onShareSuccess?.();
            }

        } catch (error) {
            console.error("Share failed", error);
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div className="relative group">
            <div ref={cardRef} className="h-full">
                {children}
            </div>

            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <AppButton
                    onClick={handleShare}
                    variant="ghost"
                    size="sm"
                    className="bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm rounded-full w-8 h-8 !p-0 flex items-center justify-center border border-white/10"
                    disabled={isSharing}
                >
                    {isSharing ? (
                        <div className="w-3 h-3 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                    ) : (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                            <polyline points="16 6 12 2 8 6" />
                            <line x1="12" y1="2" x2="12" y2="15" />
                        </svg>
                    )}
                </AppButton>
            </div>
        </div>
    );
};
