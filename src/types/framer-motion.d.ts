import "framer-motion";
import type { Transition } from "framer-motion";

declare module "framer-motion" {
  interface MotionProps {
    layoutId?: string;
    transition?: Transition;
  }
}
