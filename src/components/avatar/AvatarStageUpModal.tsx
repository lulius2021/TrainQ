// src/components/avatar/AvatarStageUpModal.tsx
// Full-screen celebration overlay when the user reaches a new stage.

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RobotAvatarSvg from "./RobotAvatarSvg";
import { STAGE_NAMES } from "../../utils/avatarProgression";

// Workaround for Framer Motion typing issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const M = motion.div as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MH2 = motion.h2 as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MP = motion.p as any;

type Props = {
  data: { stage: number; variant: "bulk" | "speed" } | null;
  onDismiss: () => void;
};

/** Random confetti particle. */
function Particle({ delay, color }: { delay: number; color: string }) {
  const x = Math.random() * 100;
  const rot = Math.random() * 360;
  return (
    <M
      className="absolute w-2.5 h-2.5 rounded-sm"
      style={{ left: `${x}%`, top: "-5%", backgroundColor: color, rotate: rot }}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: "110vh", scale: 0.5, rotate: rot + 360 }}
      transition={{ duration: 2 + Math.random(), delay, ease: "easeIn" }}
    />
  );
}

const CONFETTI_COLORS = ["#FF6B35", "#00B4D8", "#FFD166", "#E63946", "#90E0EF", "#06D6A0", "#FF9F1C"];

export default function AvatarStageUpModal({ data, onDismiss }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!data) return;
    timerRef.current = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timerRef.current);
  }, [data, onDismiss]);

  return (
    <AnimatePresence>
      {data && (
        <M
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onDismiss}
        >
          {/* Confetti particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 24 }, (_, i) => (
              <Particle
                key={i}
                delay={i * 0.08}
                color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
              />
            ))}
          </div>

          {/* Robot + text */}
          <M
            className="flex flex-col items-center gap-4"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.15 }}
          >
            <RobotAvatarSvg stage={data.stage} variant={data.variant} size={200} animate />

            <MH2
              className="text-3xl font-black text-white text-center"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Stufe {data.stage} erreicht!
            </MH2>

            <MP
              className="text-lg font-semibold text-center"
              style={{ color: data.variant === "bulk" ? "#FF6B35" : "#00B4D8" }}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.55 }}
            >
              {STAGE_NAMES[data.stage] ?? "???"}
            </MP>

            <MP
              className="text-sm text-white/50 mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              Tippe zum Schließen
            </MP>
          </M>
        </M>
      )}
    </AnimatePresence>
  );
}
