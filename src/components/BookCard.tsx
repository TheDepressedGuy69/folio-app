import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { BookMeta } from '../lib/types';
import { staggerItem, springSoft, springSnappy } from '../motion/springs';
import { BookmarkIcon, TrashIcon } from './Icons';

const FALLBACK_GRADIENTS = [
  'linear-gradient(155deg,#3e5c4e,#27392f)',
  'linear-gradient(155deg,#b8863b,#7a5a22)',
  'linear-gradient(155deg,#8a4a3e,#5c2e26)',
  'linear-gradient(155deg,#3e4e5c,#26313c)',
  'linear-gradient(155deg,#5c3e5a,#372338)',
  'linear-gradient(155deg,#6b6146,#413a29)',
  'linear-gradient(155deg,#c1652f,#8a431c)',
];

function gradientFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_GRADIENTS[hash % FALLBACK_GRADIENTS.length];
}

interface Props {
  book: BookMeta;
  bookmarked?: boolean;
  onDelete?: (book: BookMeta) => void;
}

export default function BookCard({ book, bookmarked, onDelete }: Props) {
  const navigate = useNavigate();
  // Grid cards show a short title only — long subtitles ("Title: A Subtitle
  // (Series Book N)") get cut at the first colon/paren, with the full title
  // still available as a tooltip.
  const displayTitle = book.title.split(/[:(]/)[0].trim() || book.title;
  const [confirming, setConfirming] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirming) return;
    const onOutside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setConfirming(false);
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [confirming]);

  return (
    <motion.div
      ref={rootRef}
      variants={staggerItem}
      whileHover={{ y: -6, transition: springSoft }}
      whileTap={{ scale: confirming ? 1 : 0.97 }}
      onClick={() => !confirming && navigate(`/read/${book.id}`)}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }}
      className="book-card"
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '2 / 3',
          borderRadius: 5,
          background: book.coverDataUrl ? `url(${book.coverDataUrl}) center/cover` : gradientFor(book.id),
          boxShadow: '0 8px 16px rgba(var(--shadow-color), .22)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {bookmarked && (
          <div
            title="Has a saved bookmark"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 20,
              height: 20,
              borderRadius: 5,
              background: 'rgba(0,0,0,.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BookmarkIcon size={10} filled color="#fff" />
          </div>
        )}
        {onDelete && (
          <motion.button
            className="book-card-delete"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
            }}
            aria-label={`Remove ${book.title} from library`}
            title="Remove from library"
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              width: 26,
              height: 26,
              borderRadius: 7,
              border: 'none',
              background: 'rgba(20,17,15,.65)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
            }}
          >
            <TrashIcon size={13} />
          </motion.button>
        )}

        <AnimatePresence>
          {confirming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={springSnappy}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(10,9,8,.82)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: 14,
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 11.5, color: '#f2efe8', lineHeight: 1.35 }}>Remove from library?</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                <button
                  onClick={() => {
                    setConfirming(false);
                    onDelete?.(book);
                  }}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 7,
                    border: 'none',
                    background: '#a8453f',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Remove
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 7,
                    border: 'none',
                    background: 'rgba(255,255,255,.14)',
                    color: '#f2efe8',
                    fontSize: 11,
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div
        title={book.title}
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: 1.25,
          height: 31,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {displayTitle}
      </div>
      <div
        title={book.author}
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          height: 14,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {book.author}
      </div>
    </motion.div>
  );
}
