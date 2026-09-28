import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { springSoft } from '../motion/springs';
import { SearchIcon } from './Icons';
import type { SearchResult } from '../reader/readerTypes';

interface Props {
  open: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
  onJump: (result: SearchResult) => void;
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)', borderRadius: 2 }}>
        {text.slice(idx, idx + query.trim().length)}
      </mark>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

export default function SearchPanel({ open, onClose, onSearch, onJump }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const t = setTimeout(() => {
      onSearch(q).then((r) => {
        if (requestId.current === id) {
          setResults(r);
          setLoading(false);
        }
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query, onSearch]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={springSoft}
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 420,
            maxHeight: 420,
            background: 'var(--surface)',
            border: '1px solid var(--surface-border)',
            borderRadius: 14,
            boxShadow: '0 16px 34px rgba(0,0,0,.35)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 30,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--divider)' }}>
            <SearchIcon size={16} color="var(--text-dim)" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && onClose()}
              placeholder="Search this book…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit' }}
            />
          </div>

          <div className="scroll-y" style={{ overflowY: 'auto', maxHeight: 360 }}>
            {loading && <div style={{ padding: '18px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>Searching…</div>}
            {!loading && results !== null && results.length === 0 && (
              <div style={{ padding: '18px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>No matches for "{query.trim()}".</div>
            )}
            {!loading &&
              results?.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onJump(r)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--divider)',
                    cursor: 'pointer',
                  }}
                >
                  {r.label && (
                    <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginBottom: 3 }}>{r.label}</div>
                  )}
                  <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.45 }}>{highlight(r.excerpt, query)}</div>
                </button>
              ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
