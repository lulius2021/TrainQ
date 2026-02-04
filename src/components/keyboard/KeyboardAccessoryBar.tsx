// src/components/keyboard/KeyboardAccessoryBar.tsx

import React from "react";

export function KeyboardAccessoryBar(props: {
  visible: boolean;
  keyboardHeight: number;
  rightButton?: React.ReactNode;
  /** extra Abstand über der Tastatur */
  offsetPx?: number;
}) {
  const { visible, keyboardHeight, rightButton, offsetPx = 12 } = props;
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: Math.max(0, keyboardHeight) + offsetPx,
        zIndex: 9999,
        pointerEvents: "none", // Container blockt nichts
      }}
    >
      <div style={{ pointerEvents: "auto" }}>{rightButton}</div>
    </div>
  );
}