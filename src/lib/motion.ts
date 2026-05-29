import type { Transition, Variants } from "framer-motion";

export const EASE_OUT = [0.32, 0.72, 0, 1] as const;
export const EASE_STANDARD = [0.4, 0, 0.2, 1] as const;

export const transitions = {
  fast: { duration: 0.15, ease: EASE_STANDARD } satisfies Transition,
  normal: { duration: 0.28, ease: EASE_OUT } satisfies Transition,
  slow: { duration: 0.4, ease: EASE_OUT } satisfies Transition,
  spring: { type: "spring", stiffness: 420, damping: 32 } satisfies Transition,
  springSoft: { type: "spring", stiffness: 300, damping: 28 } satisfies Transition,
} as const;

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitions.normal,
  },
};

export const tapScale = { scale: 0.97 } as const;
export const hoverLift = { y: -2 } as const;

export const widthTransition: Transition = { duration: 0.28, ease: EASE_OUT };
export const labelTransition: Transition = { duration: 0.22, ease: EASE_STANDARD };
