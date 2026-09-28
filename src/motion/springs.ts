import type { Transition } from 'framer-motion';

/** Snappy UI feedback — buttons, toggles, small controls. */
export const springSnappy: Transition = { type: 'spring', stiffness: 500, damping: 32, mass: 0.6 };

/** Soft, fluid motion — panels, popovers, cards. "Water-like." */
export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 28, mass: 0.9 };

/** Gentle settle — page-turn release, progress bar. */
export const springSettle: Transition = { type: 'spring', stiffness: 220, damping: 26, mass: 1 };

/** Sliding pill / shared-layout indicators. */
export const springPill: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 };

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.035, delayChildren: 0.02 },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: springSoft },
};
