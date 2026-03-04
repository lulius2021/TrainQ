import { motion, type MotionProps } from "framer-motion";

export const MotionDiv = motion.div as React.FC<
  MotionProps & React.HTMLAttributes<HTMLDivElement> & { layout?: boolean | string }
>;
