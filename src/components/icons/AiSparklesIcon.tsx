// src/components/icons/AiSparklesIcon.tsx
// Custom AI sparkles icon (4-point stars + "AI" text)

import React from "react";

interface AiSparklesIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export function AiSparklesIcon({ size = 20, color = "currentColor", className }: AiSparklesIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Large 4-point star */}
      <path
        d="M10 2 L11.5 7.5 L17 9 L11.5 10.5 L10 16 L8.5 10.5 L3 9 L8.5 7.5 Z"
        fill={color}
      />
      {/* Small 4-point star (top right) */}
      <path
        d="M18 1 L18.8 3.2 L21 4 L18.8 4.8 L18 7 L17.2 4.8 L15 4 L17.2 3.2 Z"
        fill={color}
        opacity={0.7}
      />
      {/* Small 4-point star (bottom) */}
      <path
        d="M6 16 L6.6 17.7 L8.3 18.3 L6.6 18.9 L6 20.6 L5.4 18.9 L3.7 18.3 L5.4 17.7 Z"
        fill={color}
        opacity={0.5}
      />
      {/* "AI" text */}
      <text
        x="18.5"
        y="19"
        fill={color}
        fontSize="8.5"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
        textAnchor="middle"
        dominantBaseline="auto"
      >
        AI
      </text>
    </svg>
  );
}
