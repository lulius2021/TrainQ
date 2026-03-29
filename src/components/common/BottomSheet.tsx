import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useModalStore } from "../../store/useModalStore";
import { hapticSheetClose } from "../../native/haptics";

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
  backdropClassName?: string;
  variant?: "floating" | "docked";
  showHandle?: boolean;
  /** Override the children wrapper className (default: "flex-1 overflow-y-auto") */
  contentClassName?: string;
};

const CLOSE_OFFSET_PX = 120;
const CLOSE_VELOCITY_PX = 800;

export function BottomSheet({
  open,
  onClose,
  header,
  footer,
  children,
  height = "88dvh",
  maxHeight = "92dvh",
  zIndex = 200,
  bottomOffset = "0px",
  sheetStyle,
  footerStyle,
  backdropClassName,
  variant = "docked",
  showHandle = true,
  contentClassName,
}: BottomSheetProps) {
  const dragControls = useDragControls();
  const push = useModalStore((s) => s.push);
  const pop  = useModalStore((s) => s.pop);
  const [clickShield, setClickShield] = useState(false);
  const shieldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = React.useCallback(() => {
    hapticSheetClose();
    onClose();
    setClickShield(true);
    if (shieldTimer.current) clearTimeout(shieldTimer.current);
    shieldTimer.current = setTimeout(() => setClickShield(false), 400);
  }, [onClose]);

  useEffect(() => () => { if (shieldTimer.current) clearTimeout(shieldTimer.current); }, []);

  // Register with modal store so BottomNav hides
  useEffect(() => {
    if (open) { push(); return () => pop(); }
  }, [open, push, pop]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: DragInfo) => {
    if (info.offset.y > CLOSE_OFFSET_PX || info.velocity.y > CLOSE_VELOCITY_PX) handleClose();
  };

  const MotionDiv = motion.div as unknown as React.ComponentType<any>;

  const footerBaseStyle: React.CSSProperties = {
    background: "var(--card-bg)",
    borderTop: "1px solid var(--border-color)",
    paddingBottom: "env(safe-area-inset-bottom)",
  };

  return (
    <>
      {/* Click shield: absorbs ghost clicks for 400ms after close */}
      {clickShield && !open && (
        <div
          className="fixed inset-0"
          style={{ zIndex: zIndex + 1, touchAction: "none" }}
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => e.preventDefault()}
        />
      )}
    <AnimatePresence>
      {open && (
        <MotionDiv
          className="fixed inset-0"
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className={backdropClassName ?? "absolute inset-0"}
            style={!backdropClassName ? { backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", touchAction: "none" } : undefined}
            onPointerDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); handleClose(); } }}
          />

          {/* Sheet */}
          <div
            className="fixed left-0 right-0 flex justify-center px-0"
            style={{ bottom: bottomOffset }}
          >
            <MotionDiv
              className="w-full max-w-md shadow-2xl shadow-black/40 flex flex-col rounded-t-[28px]"
              style={{ ...sheetStyle, height, maxHeight, background: sheetStyle?.background ?? "var(--card-bg)" }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
            >
              {/* Handle / header drag zone — tall touch target for easy swipe */}
              <div
                className={showHandle || header ? "pt-2 pb-1" : ""}
                onPointerDown={(e: React.PointerEvent) => dragControls.start(e)}
                style={{ cursor: "grab" }}
              >
                {showHandle && (
                  <div className="flex justify-center py-2">
                    <div className="h-1.5 w-10 rounded-full" style={{ background: "var(--border-color)" }} />
                  </div>
                )}
                {header && <div className="pt-1">{header}</div>}
              </div>

              <div className={contentClassName ?? "flex-1 overflow-y-auto"}>{children}</div>

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
    </>
  );
}
