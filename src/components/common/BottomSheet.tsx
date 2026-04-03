import React, { useEffect } from "react";
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

const CLOSE_OFFSET_PX = 80;
const CLOSE_VELOCITY_PX = 500;

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
  const activateShield = useModalStore((s) => s.activateShield);

  const handleClose = React.useCallback(() => {
    hapticSheetClose();
    activateShield();
    onClose();
  }, [onClose, activateShield]);

  // Register with modal store so BottomNav hides
  useEffect(() => {
    if (open) { push(); return () => pop(); }
  }, [open, push, pop]);

  // Lock ALL scroll containers while sheet is open — adds/removes .modal-open on #root
  useEffect(() => {
    if (!open) return;
    const root = document.getElementById("root");
    root?.classList.add("modal-open");

    // Prevent touchmove outside sheet content for extra iOS reliability
    const preventScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-sheet-content]")) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      root?.classList.remove("modal-open");
      document.removeEventListener("touchmove", preventScroll);
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
    <AnimatePresence>
      {open && (
        <MotionDiv
          className="fixed inset-0"
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div
            className={backdropClassName ?? "absolute inset-0"}
            style={!backdropClassName ? { backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", touchAction: "none", overscrollBehavior: "none" } : undefined}
            onPointerDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); handleClose(); } }}
            onTouchMove={(e) => e.preventDefault()}
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
              exit={{ y: "105%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0.15, bottom: 0 }}
              onDragEnd={handleDragEnd}
            >
              {/* Handle / header drag zone */}
              <div
                className="relative shrink-0"
                onPointerDown={(e: React.PointerEvent) => dragControls.start(e)}
                onTouchStart={(e: React.TouchEvent) => {
                  const pe = e as unknown as React.PointerEvent;
                  dragControls.start(pe);
                }}
                style={{ cursor: "grab", touchAction: "none", minHeight: 64 }}
              >
                {showHandle && (
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="h-1.5 w-14 rounded-full" style={{ background: "var(--border-color)" }} />
                  </div>
                )}
                {header
                  ? <div className="pt-2 pb-3">{header}</div>
                  : showHandle && <div style={{ height: 36 }} />
                }
              </div>

              <div
                data-sheet-content
                className={contentClassName ?? "flex-1 min-h-0 overflow-y-auto"}
                style={{ overscrollBehavior: "contain" }}
              >{children}</div>

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
