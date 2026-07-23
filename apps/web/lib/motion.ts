import type { Transition, Variants } from "framer-motion";

/** Shared easing curves for a cohesive, premium feel */
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
export const easeInOut = [0.45, 0, 0.15, 1] as const;

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 28
};

export const springSoft: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 26
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35, ease: easeOutExpo } },
  exit: { opacity: 0, transition: { duration: 0.22, ease: easeInOut } }
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOutExpo } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.25, ease: easeInOut } }
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOutExpo } }
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.38, ease: easeOutExpo } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.22 } }
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: easeOutExpo } },
  exit: { opacity: 0, x: 16, transition: { duration: 0.25 } }
};

export const staggerContainer = (stagger = 0.06, delayChildren = 0.04): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren }
  }
});

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: easeOutExpo } }
};

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: easeOutExpo } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.26, ease: easeInOut } }
};
