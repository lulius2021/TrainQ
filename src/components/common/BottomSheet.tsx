import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useModalStore } from "../../store/useModalStore";
import { hapticSheetClose } from "../../native/haptics";

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

const MotionDiv = motion.div as unknown as React.ComponentType<any>;

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
  const push = useModalStore((s) => s.push);
  const pop  = useModalStore((s) => s.pop);
  const activateShield = useModalStore((s) => s.activateShield);

  // Drag state managed manually for iOS reliability
  const dragStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const currentTranslateY = useRef(0);
  const isDragging = useRef(false);

  const handleClose = React.useCallback(() => {
    hapticSheetClose();
    activateShield();
    onClose();
  }, [onClose, activateShield]);

  useEffect(() => {
    if (open) { push(); return () => pop(); }
  }, [open, push, pop]);

  useEffect(() => {
    if (!open) return;
    const root = document.getElementById("root");
    root?.classList.add("modal-open");

    const preventScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-sheet-content]")) return;
      if (target.closest("[data-sheet-handle]")) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      root?.classList.remove("modal-open");
      document.removeEventListener("touchmove", preventScroll);
    };
  }, [open]);

  // Manual drag handlers for the handle area
  const onHandleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, [role='button']")) return;
    dragStartY.current = e.touches[0].clientY;
    currentTranslateY.current = 0;
    isDragging.current = true;
  };

  const onHandleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null || !isDragging.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    // Only allow dragging down, slight resistance up
    const translate = dy > 0 ? dy : dy * 0.1;
    currentTranslateY.current = translate;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${Math.max(0, translate)}px)`;
      sheetRef.current.style.transition = "none";
    }
  };

  const onHandleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    dragStartY.current = null;

    const dy = currentTranslateY.current;

    if (sheetRef.current) {
      if (dy > CLOSE_OFFSET_PX) {
        // Close: animate out
        sheetRef.current.style.transition = "transform 0.3s ease-out";
        sheetRef.current.style.transform = "translateY(110%)";
        setTimeout(handleClose, 300);
      } else {
        // Snap back
        sheetRef.current.style.transition = "transform 0.25s ease-out";
        sheetRef.current.style.transform = "translateY(0px)";
      }
    }
    currentTranslateY.current = 0;
  };

  const footerBaseStyle: React.CSSProperties = {
    background: "var(--card-bg)",
    borderTop: "1px solid var(--border-color)",
    paddingBottom: "env(safe-area-inset-bottom)",
  };

  return createPortal(
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
            ref={sheetRef}
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
            >
              {/* Inner content */}
              <div className="flex flex-col h-full rounded-t-[28px] overflow-hidden" style={{ background: sheetStyle?.background ?? "var(--card-bg)" }}>
                {/* Handle / header drag zone */}
                <div
                  data-sheet-handle
                  className="relative shrink-0"
                  onTouchStart={onHandleTouchStart}
                  onTouchMove={onHandleTouchMove}
                  onTouchEnd={onHandleTouchEnd}
                  style={{ cursor: "grab", touchAction: "none", minHeight: 48 }}
                >
                  {showHandle && (
                    <div className="flex justify-center pt-3 pb-1">
                      <div className="h-1.5 w-14 rounded-full" style={{ background: "var(--border-color)" }} />
                    </div>
                  )}
                  {header
                    ? <div className="pt-2 pb-3">{header}</div>
                    : showHandle && <div style={{ height: 24 }} />
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
              </div>
            </MotionDiv>
          </div>
        </MotionDiv>
      )}
    </AnimatePresence>,
    document.body
  );
}
