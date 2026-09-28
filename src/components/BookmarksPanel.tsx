import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Bookmark, Highlight } from '../lib/types';
import { HIGHLIGHT_COLORS } from '../lib/types';
import { springSoft } from '../motion/springs';
import { TrashIcon } from './Icons';

interface Props {
  open: boolean;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  onJumpBookmark: (b: Bookmark) => void;
  onJumpHighlight: (h: Highlight) => void;
  onRemoveBookmark: (id: string) => void;
  onRemoveHighlight: (id: string) => void;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function BookmarksPanel({
  open,
  bookmarks,
  highlights,
  onJumpBookmark,
  onJumpHighlight,
  onRemoveBookmark,
  onRemoveHighlight,
}: Props) {
  const [tab, setTab] = useState<'bookmarks' | 'highlights'>('bookmarks');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: 340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={springSoft}
          style={{
            width: 340,
            flex: '0 0 340px',
            background: 'var(--surface)',
            borderLeft: '1px solid var(--surface-border)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', padding: '18px 20px 0', gap: 22, borderBottom: '1px solid var(--divider)' }}>
            {(['bookmarks', 'highlights'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  position: 'relative',
                  paddingBottom: 14,
                  fontSize: 13.5,
                  fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? 'var(--text)' : 'var(--text-dim)',
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {t === 'bookmarks' ? `Bookmarks (${bookmarks.length})` : `Highlights (${highlights.length})`}
              </button>
            ))}
          </div>

          <div className="scroll-y" style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tab === 'bookmarks' &&
              (bookmarks.length === 0 ? (
                <EmptyState text="No bookmarks yet. Tap the ribbon icon in the toolbar to add one." />
              ) : (
                bookmarks
                  .slice()
                  .sort((a, b) => b.addedAt - a.addedAt)
                  .map((b) => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: 14,
                        borderRadius: 10,
                        background: 'var(--bg-alt)',
                        border: '1px solid var(--divider)',
                        cursor: 'pointer',
                      }}
                      onClick={() => onJumpBookmark(b)}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 24,
                          background: 'var(--accent)',
                          clipPath: 'polygon(0 0,100% 0,100% 100%,50% 76%,0 100%)',
                          flex: '0 0 auto',
                          marginTop: 2,
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{b.label}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>Added {formatDate(b.addedAt)}</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveBookmark(b.id);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-faint)', alignSelf: 'flex-start' }}
                        aria-label="Remove bookmark"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  ))
              ))}

            {tab === 'highlights' &&
              (highlights.length === 0 ? (
                <EmptyState text="No highlights yet. Switch to Highlight mode and select some text." />
              ) : (
                highlights
                  .slice()
                  .sort((a, b) => b.addedAt - a.addedAt)
                  .map((h) => (
                    <div
                      key={h.id}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: 14,
                        borderRadius: 10,
                        background: 'var(--bg-alt)',
                        border: '1px solid var(--divider)',
                        cursor: 'pointer',
                      }}
                      onClick={() => onJumpHighlight(h)}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 24,
                          background: HIGHLIGHT_COLORS[h.color],
                          clipPath: 'polygon(0 0,100% 0,100% 100%,50% 76%,0 100%)',
                          flex: '0 0 auto',
                          marginTop: 2,
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
                          "{h.text.slice(0, 90)}
                          {h.text.length > 90 ? '…' : ''}"
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>Added {formatDate(h.addedAt)}</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveHighlight(h.id);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-faint)', alignSelf: 'flex-start' }}
                        aria-label="Remove highlight"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  ))
              ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5, padding: '20px 4px' }}>{text}</div>;
}
