import React, { useMemo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiOverlayProps {
  show: boolean;
  onDone?: () => void;
}

const COLORS = ["#FFD700", "#FF8C00", "#007AFF"];
const PARTICLE_COUNT = 40;
const DURATION = 2;

interface Particle {
  id: number;
  x: number;
  color: string;
  rotation: number;
  delay: number;
  size: number;
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * 720 - 360,
    delay: Math.random() * 0.4,
    size: 6 + Math.random() * 6,
  }));
}

// Workaround for Framer Motion typing issues with motion.div
const MotionDiv = motion.div as any;

export default function ConfettiOverlay({ show, onDone }: ConfettiOverlayProps) {
  const [visible, setVisible] = useState(false);
  const particles = useMemo(() => generateParticles(), []);

  useEffect(() => {
    if (!show) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, DURATION * 1000);
    return () => clearTimeout(timer);
  }, [show, onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <MotionDiv
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] pointer-events-none overflow-hidden"
        >
          {particles.map((p) => (
            <MotionDiv
              key={p.id}
              initial={{
                x: `${p.x}vw`,
                y: -20,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                y: "110vh",
                rotate: p.rotation,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: DURATION,
                delay: p.delay,
                ease: "easeIn",
              }}
              style={{
                position: "absolute",
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: 2,
              }}
            />
          ))}
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}
