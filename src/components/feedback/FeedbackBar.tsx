// src/components/feedback/FeedbackBar.tsx
import { useEffect, useState } from "react";
import { FeedbackModal } from "./FeedbackModal";
import { useI18n } from "../../i18n/useI18n";

interface FeedbackBarProps {
  page: string; // z.B. "Dashboard", "Kalender", "Trainingsplan", "Profil"
}

export function FeedbackBar({ page }: FeedbackBarProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  // ✅ verhindert "Hintergrund scrollen" + reduziert iOS-typisches Rum-Scrollen/Overdrag
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = (document.body.style as any).overscrollBehavior;

    document.body.style.overflow = "hidden";
    (document.body.style as any).overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = prevOverflow;
      (document.body.style as any).overscrollBehavior = prevOverscroll;
    };
  }, [isOpen]);


  return (
    <>
      <div className="w-full flex justify-center mt-6 mb-3 text-[12px]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-white/55 hover:text-blue-400 underline underline-offset-2"
        >
          {t("feedback.cta")}
        </button>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4 sm:p-6 overscroll-contain touch-pan-y"
          data-overlay-open="true"
          style={{
            // iOS: weniger "Gummiband"-Scroll/Seitwärts-Drag
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          }}
          onMouseDown={(e) => {
            // Klick außerhalb schließt (sauberer als “rechts/links schwischen”)
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="w-full max-w-[560px] max-h-[85vh] overflow-y-auto">
            <FeedbackModal page={page} onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
