// src/components/avatar/AvatarStageUpModal.tsx
// Milestone celebration: a body part just reached a new level.

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HumanAvatarSvg from "./HumanAvatarSvg";
import { levelLabel } from "../../utils/avatarProgression";
import type { BodyPartKey } from "../../utils/avatarProgression";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const M = motion.div as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MH2 = motion.h2 as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MP = motion.p as any;

type Props = {
  /** Milestone data — bodyPart + newLevel come from grantWorkoutXp */
  data: {
    stage: number;
    variant: "bulk" | "speed";
    /** Extended milestone info (optional, added by new store) */
    bodyPart?: BodyPartKey;
  } | null;
  onDismiss: () => void;
};

const PART_LABELS: Record<string, string> = {
  chest:     "Brust",
  back:      "Rücken",
  shoulders: "Schultern",
  arms:      "Arme",
  legs:      "Beine",
  core:      "Core",
  cardio:    "Ausdauer",
};

const PART_ACCENTS: Record<string, string> = {
  chest:     "#FF6B35",
  back:      "#F59E0B",
  shoulders: "#3B82F6",
  arms:      "#EF4444",
  legs:      "#8B5CF6",
  core:      "#10B981",
  cardio:    "#EC4899",
};

const CONFETTI = ["#FF6B35", "#00B4D8", "#FFD166", "#E63946", "#90E0EF", "#06D6A0", "#A78BFA"];

function Particle({ delay, color }: { delay: number; color: string }) {
  const x = Math.random() * 100;
  return (
    <M
      className="absolute w-2.5 h-2.5 rounded-sm"
      style={{ left: `${x}%`, top: "-5%", backgroundColor: color, rotate: Math.random() * 360 }}
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 0, y: "110vh", rotate: Math.random() * 720 }}
      transition={{ duration: 2 + Math.random(), delay, ease: "easeIn" }}
    />
  );
}

export default function AvatarStageUpModal({ data, onDismiss }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!data) return;
    timerRef.current = setTimeout(onDismiss, 4500);
    return () => clearTimeout(timerRef.current);
  }, [data, onDismiss]);

  const bodyPart = data?.bodyPart;
  const level    = data?.stage ?? 0;
  const accent   = PART_ACCENTS[bodyPart ?? ""] ?? "#FF6B35";
  const partName = PART_LABELS[bodyPart ?? ""] ?? "Muskel";

  // Build bodyLevels so the highlighted part looks strong
  const bodyLevels = {
    chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, core: 0, cardio: 0,
    ...(bodyPart ? { [bodyPart]: level } : {}),
  };

  return (
    <AnimatePresence>
      {data && (
        <M
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onDismiss}
        >
          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 28 }, (_, i) => (
              <Particle key={i} delay={i * 0.07} color={CONFETTI[i % CONFETTI.length]} />
            ))}
          </div>

          <M
            className="flex flex-col items-center gap-4"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.15 }}
          >
            <HumanAvatarSvg
              pose="stand"
              bodyLevels={bodyLevels}
              size={160}
              animate
              accentColor={accent}
            />

            {/* Badge */}
            <div
              className="px-4 py-1.5 rounded-full text-sm font-bold"
              style={{ background: `${accent}33`, color: accent, border: `1.5px solid ${accent}66` }}
            >
              Level {level} erreicht!
            </div>

            <MH2
              className="text-3xl font-black text-white text-center"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {partName} {levelLabel(level)}
            </MH2>

            <MP
              className="text-sm text-white/50 text-center max-w-[220px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              Weiter trainieren, um noch stärker zu werden!
            </MP>

            <MP
              className="text-xs text-white/30 mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
            >
              Tippe zum Schließen
            </MP>
          </M>
        </M>
      )}
    </AnimatePresence>
  );
}
