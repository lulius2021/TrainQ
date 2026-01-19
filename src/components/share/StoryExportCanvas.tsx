import React from "react";

type Props = {
  children: React.ReactNode;
  exportSafe?: boolean;
};

export default function StoryExportCanvas({ children, exportSafe = false }: Props) {
  return (
    <div
      data-story-export-root="true"
      style={{
        width: "1080px",
        height: "1920px",
        position: "relative",
        overflow: "hidden",
        background: exportSafe
          ? "#0F172A"
          : "linear-gradient(160deg, #0B1220 0%, #070B14 55%, #05060A 100%)",
        color: "#F8FAFC",
        fontFamily: '"SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: exportSafe
            ? "radial-gradient(circle at 25% 20%, rgba(80,120,255,0.28), transparent 55%), radial-gradient(circle at 80% 35%, rgba(120,255,220,0.18), transparent 60%)"
            : "radial-gradient(circle at 25% 20%, rgba(80,120,255,0.35), transparent 55%), radial-gradient(circle at 80% 35%, rgba(120,255,220,0.22), transparent 60%)",
          opacity: 1,
          pointerEvents: "none",
        }}
      />
      {children}
    </div>
  );
}
