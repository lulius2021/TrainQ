// src/hooks/useEdgeBackSwipe.ts
import { useEffect, useRef } from "react";

type Options = {
  enabled: boolean;
  onBack: () => void;
  isBlocked?: () => boolean;
  noSwipeSelector?: string;
  edgePx?: number;
  thresholdPx?: number;
  uiOverlayOpen?: boolean;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const editable = target.closest(
    'input, textarea, select, [contenteditable="true"], [contenteditable=""]'
  );
  return !!editable;
}

function hasNoSwipe(target: EventTarget | null, selector?: string): boolean {
  if (!selector) return false;
  if (!(target instanceof Element)) return false;
  return !!target.closest(selector);
}

function hasOverlayOpen(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.classList.contains("modal-open")) return true;
  return !!document.querySelector('[data-overlay-open="true"]');
}

export function useEdgeBackSwipe({
  enabled,
  onBack,
  isBlocked,
  noSwipeSelector,
  edgePx = 24,
  thresholdPx = 80,
  uiOverlayOpen,
}: Options) {
  const stateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    pointerId: number | null;
  }>({ active: false, startX: 0, startY: 0, pointerId: null });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!enabled || uiOverlayOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!enabled || uiOverlayOpen) return;
      if (isBlocked?.() || hasOverlayOpen()) return;
      if (!e.isPrimary) return;
      if (e.pointerType === "mouse") return;
      if (e.clientX > edgePx) return;
      if (isEditableTarget(e.target)) return;
      if (hasNoSwipe(e.target, noSwipeSelector)) return;

      stateRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const state = stateRef.current;
      if (!state.active) return;
      if (state.pointerId !== e.pointerId) return;
      if (uiOverlayOpen) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      if (dx < thresholdPx) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.3) return;

      stateRef.current.active = false;
      onBack();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (stateRef.current.pointerId !== e.pointerId) return;
      stateRef.current.active = false;
      stateRef.current.pointerId = null;
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [edgePx, enabled, isBlocked, noSwipeSelector, onBack, thresholdPx, uiOverlayOpen]);
}
