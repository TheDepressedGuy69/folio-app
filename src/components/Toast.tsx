import { AnimatePresence, motion } from 'framer-motion';
import { springSoft } from '../motion/springs';

export interface ToastItem {
  id: number;
  text: string;
}

export default function Toast({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={springSoft}
            style={{
              background: '#211d18',
              color: '#f7f1e3',
              padding: '10px 18px',
              borderRadius: 999,
              fontSize: 13,
              boxShadow: '0 10px 24px rgba(0,0,0,.35)',
            }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
