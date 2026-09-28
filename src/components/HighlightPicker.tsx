import { AnimatePresence, motion } from 'framer-motion';
import type { HighlightColor } from '../lib/types';
import { HIGHLIGHT_COLORS } from '../lib/types';
import { springSnappy } from '../motion/springs';

const COLORS: HighlightColor[] = ['yellow', 'green', 'red', 'blue'];

export default function HighlightPicker({
  open,
  onPick,
  onCancel,
}: {
  open: boolean;
  onPick: (c: HighlightColor) => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={springSnappy}
          style={{
            position: 'absolute',
            bottom: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#211d18',
            borderRadius: 12,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 12px 28px rgba(0,0,0,.4)',
            zIndex: 30,
          }}
        >
          {COLORS.map((c) => (
            <motion.button
              key={c}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onPick(c)}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: HIGHLIGHT_COLORS[c],
                border: '2px solid rgba(255,255,255,0.25)',
              }}
              aria-label={`Highlight ${c}`}
            />
          ))}
          <div style={{ width: 1, height: 18, background: '#3a332a', margin: '0 2px' }} />
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', color: '#c9bfa9', fontSize: 12 }}
          >
            Cancel
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
