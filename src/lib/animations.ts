/**
 * Shared Framer Motion animation presets for TrainQ.
 * Use these everywhere — never define custom durations/easings inline.
 */

// ── Easing ────────────────────────────────────────────────────────────────────
export const ease = {
  out: [0.0, 0.0, 0.2, 1.0] as const,
  inOut: [0.4, 0.0, 0.2, 1.0] as const,
  spring: { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.8 },
  springSnappy: { type: "spring" as const, stiffness: 480, damping: 38, mass: 0.7 },
};

// ── Page-level entrance (used when a full page mounts) ────────────────────────
export const pageVariants = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.26, ease: ease.out } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18, ease: ease.inOut } },
};

// ── Slide in from right (sub-pages, drill-down) ───────────────────────────────
export const slideRightVariants = {
  hidden:  { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.28, ease: ease.out } },
  exit:    { opacity: 0, x: -20, transition: { duration: 0.2, ease: ease.inOut } },
};

// ── Card / section entrance ───────────────────────────────────────────────────
export const cardVariants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.22, ease: ease.out } },
};

// ── Stagger container (wrap around lists/grids) ───────────────────────────────
export const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};

// ── Stagger item (use as variants on each child) ──────────────────────────────
export const staggerItem = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.22, ease: ease.out } },
};

// ── Fade only (for overlays, badges, etc.) ────────────────────────────────────
export const fadeVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.14 } },
};

// ── Scale-pop (for buttons, badges on first appear) ──────────────────────────
export const popVariants = {
  hidden:  { opacity: 0, scale: 0.88 },
  visible: { opacity: 1, scale: 1, transition: ease.springSnappy },
  exit:    { opacity: 0, scale: 0.92, transition: { duration: 0.14 } },
};
