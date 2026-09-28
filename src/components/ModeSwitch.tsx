import { motion } from 'framer-motion';
import { springPill } from '../motion/springs';

type Mode = 'read' | 'highlight';

export default function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const items: { key: Mode; label: string }[] = [
    { key: 'read', label: 'Read' },
    { key: 'highlight', label: 'Highlight' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--surface-border)',
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {items.map((item) => {
        const active = mode === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            style={{
              position: 'relative',
              padding: '7px 16px',
              borderRadius: 7,
              border: 'none',
              background: 'transparent',
              color: active ? 'var(--btn-fg)' : 'var(--text-dim)',
              fontSize: 12.5,
              fontWeight: active ? 700 : 400,
              zIndex: 1,
            }}
          >
            {active && (
              <motion.div
                layoutId="mode-switch-pill"
                transition={springPill}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--accent)',
                  borderRadius: 7,
                  zIndex: -1,
                }}
              />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
