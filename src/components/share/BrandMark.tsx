import React from "react";

type Props = {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "light" | "dark";
  showWordmark?: boolean;
};

const sizes = {
  sm: { icon: 56, text: 18, gap: 12 },
  md: { icon: 64, text: 20, gap: 14 },
  lg: { icon: 72, text: 22, gap: 16 },
  xl: { icon: 92, text: 26, gap: 18 },
};

export default function BrandMark({ size = "sm", variant = "light", showWordmark = true }: Props) {
  const palette =
    variant === "dark"
      ? { text: "#0f172a", ring: "rgba(15,23,42,0.2)", bg: "rgba(255,255,255,0.9)" }
      : { text: "#f8fafc", ring: "rgba(248,250,252,0.25)", bg: "rgba(15,23,42,0.5)" };
  const dim = sizes[size];
  const logoSrc = typeof window !== "undefined" ? `${window.location.origin}/brand/logo.png` : "/brand/logo.png";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: dim.gap }}>
      <img
        src={logoSrc}
        alt="TrainQ"
        width={dim.icon}
        height={dim.icon}
        loading="eager"
        decoding="async"
        crossOrigin="anonymous"
        draggable={false}
        data-brand-logo="true"
        style={{ display: "block", objectFit: "contain" }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      {showWordmark && (
        <div style={{ fontSize: dim.text, fontWeight: 900, letterSpacing: 0.5, color: palette.text }}>TrainQ</div>
      )}
    </div>
  );
}
