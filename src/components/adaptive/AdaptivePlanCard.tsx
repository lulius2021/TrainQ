// src/components/adaptive/AdaptivePlanCard.tsx
import React from "react";
import type { AdaptiveSuggestion } from "../../types/adaptive";

interface AdaptivePlanCardProps {
  suggestion: AdaptiveSuggestion;
  isPro?: boolean;
}

const GRADIENTS: Record<string, { base: string; blob1: string; blob2: string }> = {
  stabil: {
    base:  "linear-gradient(145deg, #020c1b 0%, #071425 100%)",
    blob1: "radial-gradient(ellipse 85% 65% at 18% 18%, rgba(0,100,255,0.58) 0%, transparent 65%)",
    blob2: "radial-gradient(ellipse 65% 55% at 82% 88%, rgba(0,40,150,0.32) 0%, transparent 60%)",
  },
  kompakt: {
    base:  "linear-gradient(145deg, #180404 0%, #220707 100%)",
    blob1: "radial-gradient(ellipse 85% 65% at 18% 18%, rgba(220,40,28,0.60) 0%, transparent 65%)",
    blob2: "radial-gradient(ellipse 65% 55% at 82% 88%, rgba(120,15,8,0.32) 0%, transparent 60%)",
  },
  fokus: {
    base:  "linear-gradient(145deg, #030d06 0%, #071610 100%)",
    blob1: "radial-gradient(ellipse 85% 65% at 18% 18%, rgba(18,155,58,0.60) 0%, transparent 65%)",
    blob2: "radial-gradient(ellipse 65% 55% at 82% 88%, rgba(8,75,28,0.32) 0%, transparent 60%)",
  },
};

const SPORT_ICONS: Record<string, string> = {
  stabil:  "🏋️",
  kompakt: "⚡",
  fokus:   "🎯",
};

export default function AdaptivePlanCard({ suggestion, isPro = false }: AdaptivePlanCardProps) {
  const isBlocked = suggestion.estimatedMinutes === 0;
  const g = GRADIENTS[suggestion.profile] ?? GRADIENTS.stabil;
  const icon = SPORT_ICONS[suggestion.profile] ?? "🏋️";

  return (
    <div
      className="rounded-[28px] overflow-hidden relative select-none w-full"
      style={{ height: 220, background: g.base }}
    >
      {/* Aurora blobs */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: g.blob1 }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: g.blob2 }} />

      {/* Diagonal shine */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%)" }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-between p-5 force-white">
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {isBlocked ? "— · —" : `${suggestion.estimatedMinutes} min · ${suggestion.exercisesCount} Übungen`}
            </div>
            {!isPro && suggestion.profile !== "stabil" && (
              <span
                style={{
                  alignSelf: "flex-start",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fff",
                  background: "rgba(255,255,255,0.18)",
                  borderRadius: 6,
                  padding: "2px 7px",
                  letterSpacing: "0.05em",
                }}
              >
                PRO
              </span>
            )}
          </div>
          <span style={{ fontSize: 38, lineHeight: 1, filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.6))" }}>
            {icon}
          </span>
        </div>

        {/* Bottom: title + subtitle */}
        <div>
          <h3
            style={{
              color: "#fff",
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: "-0.5px",
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            {suggestion.title}
          </h3>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 5, lineHeight: 1.4 }}>
            {suggestion.subtitle}
          </p>
        </div>
      </div>

      {/* Blocked overlay */}
      {isBlocked && (
        <div
          className="absolute inset-0 rounded-[28px] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
        >
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>
            Heute nicht empfohlen
          </span>
        </div>
      )}
    </div>
  );
}
