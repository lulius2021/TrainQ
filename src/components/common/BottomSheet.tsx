import React, { useEffect } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";

type DragInfo = { offset: { y: number }; velocity: { y: number } };

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  height?: string;
  maxHeight?: string;
  zIndex?: number;
  bottomOffset?: string;
  sheetStyle?: React.CSSProperties;
  footerStyle?: React.CSSProperties;
};

const CLOSE_OFFSET_PX = 120;
const CLOSE_VELOCITY_PX = 800;

export function BottomSheet({
  open,
  onClose,
  header,
  footer,
  children,
  height = "75dvh",
  maxHeight = "75dvh",
  zIndex = 80,
  bottomOffset = "calc(var(--bottom-nav-h) + var(--safe-bottom))",
  sheetStyle,
  footerStyle,
  backdropClassName,
  variant = "floating",
}: BottomSheetProps & { backdropClassName?: string; variant?: "floating" | "docked" }) {
  const dragControls = useDragControls();
  const footerBaseStyle: React.CSSProperties = {
    background: "var(--card-bg)",
    borderTop: "1px solid var(--border-color)",
    paddingBottom: variant === "docked" ? "env(safe-area-inset-bottom)" : 0,
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: DragInfo) => {
    if (info.offset.y > CLOSE_OFFSET_PX || info.velocity.y > CLOSE_VELOCITY_PX) {
      onClose();
    }
  };

  const MotionDiv = motion.div as unknown as React.ComponentType<any>;
  const isDocked = variant === "docked";

  return (
    <AnimatePresence>
      {open && (
        <MotionDiv
          className="fixed inset-0"
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className={`absolute inset-0 ${backdropClassName || "bg-black/70"}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} />

          <div
            className={`fixed left-0 right-0 flex justify-center ${isDocked ? "px-0" : "px-4"}`}
            style={{ bottom: isDocked ? 0 : bottomOffset }}
          >
            <MotionDiv
              className={`w-full max-w-md shadow-lg shadow-black/30 flex flex-col ${isDocked ? "rounded-t-[32px]" : "rounded-t-2xl"}`}
              style={{ ...sheetStyle, height, maxHeight }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
            >
              <div
                className="pt-3 pb-1"
                onPointerDown={(e: React.PointerEvent) => dragControls.start(e)}
              >
                <div className="flex justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-white/20" />
                </div>
                {header && <div className="pt-2">{header}</div>}
              </div>

              <div className="flex-1 overflow-y-auto">{children}</div>

              {footer && (
                <div className="shrink-0" style={{ ...footerBaseStyle, ...footerStyle }}>
                  {footer}
                </div>
              )}
            </MotionDiv>
          </div>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}
