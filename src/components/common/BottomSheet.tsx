import React, { useEffect } from "react";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";

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
}: BottomSheetProps) {
  const dragControls = useDragControls();
  const footerBaseStyle: React.CSSProperties = {
    background: "var(--surface)",
    borderTop: "1px solid var(--border)",
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > CLOSE_OFFSET_PX || info.velocity.y > CLOSE_VELOCITY_PX) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0"
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />

          <div className="fixed left-0 right-0 flex justify-center px-4" style={{ bottom: bottomOffset }}>
            <motion.div
              className="w-full max-w-md rounded-t-2xl shadow-lg shadow-black/30 flex flex-col"
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
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="pt-2 pb-1"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="flex justify-center">
                  <div className="h-1.5 w-12 rounded-full" style={{ background: "var(--border)" }} />
                </div>
                {header && <div className="pt-2">{header}</div>}
              </div>

              <div className="flex-1 overflow-y-auto">{children}</div>

              {footer && (
                <div className="shrink-0" style={{ ...footerBaseStyle, ...footerStyle }}>
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
