// src/hooks/useTabSwipeNavigation.ts
import { useEffect, useRef } from "react";

type Options = {
  enabled: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  isBlocked?: () => boolean;
  noSwipeSelector?: string;
  thresholdPx?: number;
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

export function useTabSwipeNavigation({
  enabled,
  onSwipeLeft,
  onSwipeRight,
  isBlocked,
  noSwipeSelector,
  thresholdPx = 60,
}: Options) {
  const stateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    pointerId: number | null;
  }>({ active: false, startX: 0, startY: 0, pointerId: null });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!enabled) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!enabled) return;
      if (isBlocked?.() || hasOverlayOpen()) return;
      if (!e.isPrimary) return;
      if (e.pointerType === "mouse") return;
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

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      if (Math.abs(dx) < thresholdPx) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.3) return;

      stateRef.current.active = false;
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
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
  }, [enabled, isBlocked, noSwipeSelector, onSwipeLeft, onSwipeRight, thresholdPx]);
}
