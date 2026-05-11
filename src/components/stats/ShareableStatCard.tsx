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
            const canvas = await html2canvas(cardRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: "#1C1C1E",
                onclone: (_clonedDoc, element) => {
                    const watermark = _clonedDoc.createElement("div");
                    watermark.textContent = "TrainQ";
                    watermark.style.cssText = "position:absolute;bottom:12px;right:12px;color:rgba(255,255,255,0.4);font-size:14px;font-weight:bold;font-family:sans-serif;z-index:1000;pointer-events:none;";
                    element.appendChild(watermark);
                }
            });

            const base64 = canvas.toDataURL("image/png").split(",")[1];
            if (!base64 || base64.length < 100) throw new Error("Canvas empty");

            // Use Capacitor Filesystem + Share for iOS compatibility
            const { Filesystem, Directory } = await import("@capacitor/filesystem");
            const { Share } = await import("@capacitor/share");

            const fileName = `${titleForFile}-${Date.now()}.png`;
            const saved = await Filesystem.writeFile({
                path: fileName,
                data: base64,
                directory: Directory.Cache,
            });

            await Share.share({
                title: "Mein Training auf TrainQ",
                url: saved.uri,
                files: [saved.uri],
            });
            onShareSuccess?.();
        } catch (error) {
            if (import.meta.env.DEV) console.error("Share failed", error);
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
