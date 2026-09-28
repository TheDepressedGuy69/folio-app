import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { BookMeta, ReadingProgress } from '../lib/types';
import { staggerItem, springSoft } from '../motion/springs';

export default function ContinueReadingCard({ book, progress }: { book: BookMeta; progress?: ReadingProgress }) {
  const navigate = useNavigate();
  const percent = Math.round((progress?.percent ?? 0) * 100);

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -3, transition: springSoft }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/read/${book.id}`)}
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-end',
        background: 'var(--card-bg)',
        border: '1px solid var(--surface-border)',
        borderRadius: 14,
        padding: '16px 20px 16px 16px',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 70,
          height: 102,
          borderRadius: 4,
          background: book.coverDataUrl ? `url(${book.coverDataUrl}) center/cover` : 'linear-gradient(155deg,#3e5c4e,#27392f)',
          boxShadow: '0 6px 14px rgba(var(--shadow-color), .25)',
          flex: '0 0 auto',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>{book.title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{book.author}</div>
        <div style={{ width: 170, height: 5, borderRadius: 3, background: 'var(--bg-alt)', overflow: 'hidden', marginTop: 4 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={springSoft}
            style={{ height: '100%', background: 'var(--accent)' }}
          />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{percent}% read</div>
      </div>
    </motion.div>
  );
}
