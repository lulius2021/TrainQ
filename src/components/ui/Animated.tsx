import { motion } from "framer-motion";
import { pageVariants, staggerContainer, staggerItem, cardVariants, fadeVariants, popVariants } from "../../lib/animations";
import type React from "react";

const M = motion.div as any;

type BaseProps = { children: React.ReactNode; className?: string; style?: React.CSSProperties };

/** Full-page entrance animation — wrap page content with this */
export function AnimatedPage({ children, className, style }: BaseProps) {
  return (
    <M variants={pageVariants} initial="hidden" animate="visible" exit="exit" className={className} style={style}>
      {children}
    </M>
  );
}

/** Stagger container — wrap a list/grid. Children should be <AnimatedItem>.
 *  IMPORTANT: Do NOT nest AnimatedList inside another AnimatedList — use a plain div as inner wrapper. */
export function AnimatedList({ children, className, style }: BaseProps) {
  return (
    <M variants={staggerContainer} initial="hidden" animate="visible" className={className} style={style}>
      {children}
    </M>
  );
}

/** Individual stagger child — use inside <AnimatedList> */
export function AnimatedItem({ children, className, style }: BaseProps) {
  return (
    <M variants={staggerItem} className={className} style={style}>
      {children}
    </M>
  );
}

/** Single card entrance — use when not inside a stagger list */
export function AnimatedCard({ children, className, style, delay = 0 }: BaseProps & { delay?: number }) {
  return (
    <M variants={cardVariants} initial="hidden" animate="visible" transition={{ delay }} className={className} style={style}>
      {children}
    </M>
  );
}

/** Simple fade — for overlays, badges, optional content */
export function AnimatedFade({ children, className, style }: BaseProps) {
  return (
    <M variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className={className} style={style}>
      {children}
    </M>
  );
}

/** Scale-pop — for XP badges, level-ups, completion indicators */
export function AnimatedPop({ children, className, style }: BaseProps) {
  return (
    <M variants={popVariants} initial="hidden" animate="visible" exit="exit" className={className} style={style}>
      {children}
    </M>
  );
}
