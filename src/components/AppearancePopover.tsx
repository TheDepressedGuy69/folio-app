import { AnimatePresence, motion } from 'framer-motion';
import type { BookType, ReadingTheme, Typeface } from '../lib/types';
import { READING_THEME_COLORS } from '../lib/types';
import { springSoft } from '../motion/springs';

interface Props {
  open: boolean;
  bookType: BookType;
  readingTheme: ReadingTheme;
  onReadingThemeChange: (t: ReadingTheme) => void;
  fontSize: number;
  onFontSizeChange: (n: number) => void;
  typeface: Typeface;
  onTypefaceChange: (t: Typeface) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
}

const THEMES: { key: ReadingTheme; label: string }[] = [
  { key: 'paper', label: 'Paper' },
  { key: 'sepia', label: 'Sepia' },
  { key: 'dusk', label: 'Dusk' },
  { key: 'night', label: 'Night' },
];

export default function AppearancePopover({
  open,
  bookType,
  readingTheme,
  onReadingThemeChange,
  fontSize,
  onFontSizeChange,
  typeface,
  onTypefaceChange,
  zoom,
  onZoomChange,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -8 }}
          transition={springSoft}
          style={{
            position: 'absolute',
            top: 14,
            right: 30,
            width: 288,
            background: 'var(--surface)',
            border: '1px solid var(--surface-border)',
            borderRadius: 14,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 16px 34px rgba(0,0,0,.35)',
            transformOrigin: 'top right',
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
              Theme
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              {THEMES.map((t) => {
                const active = readingTheme === t.key;
                const c = READING_THEME_COLORS[t.key];
                return (
                  <button
                    key={t.key}
                    onClick={() => onReadingThemeChange(t.key)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, flex: 1, minWidth: 0 }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.94 }}
                      style={{
                        width: 44,
                        height: 56,
                        borderRadius: 6,
                        background: c.bg,
                        border: active ? '2px solid var(--accent)' : '2px solid transparent',
                      }}
                    />
                    <span style={{ fontSize: 10.5, color: active ? 'var(--text)' : 'var(--text-dim)' }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
            {bookType === 'pdf' && (
              <div style={{ fontSize: 10.5, color: 'var(--text-faint)', lineHeight: 1.4 }}>
                PDF pages are approximated with a color filter — EPUB gets true recoloring.
              </div>
            )}
          </div>

          <div style={{ height: 1, background: 'var(--divider)' }} />

          {bookType === 'epub' ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                  Text size
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => onFontSizeChange(Math.max(70, fontSize - 10))}
                    style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-alt)', border: 'none', fontSize: 12, color: 'var(--text-dim)' }}
                  >
                    A
                  </button>
                  <input
                    type="range"
                    min={70}
                    max={180}
                    step={5}
                    value={fontSize}
                    onChange={(e) => onFontSizeChange(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                  />
                  <button
                    onClick={() => onFontSizeChange(Math.min(180, fontSize + 10))}
                    style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-alt)', border: 'none', fontSize: 17, color: 'var(--text)' }}
                  >
                    A
                  </button>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--divider)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                  Typeface
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['serif', 'sans'] as Typeface[]).map((tf) => {
                    const active = typeface === tf;
                    return (
                      <button
                        key={tf}
                        onClick={() => onTypefaceChange(tf)}
                        style={{
                          flex: 1,
                          padding: '9px 0',
                          textAlign: 'center',
                          borderRadius: 8,
                          background: 'var(--bg-alt)',
                          border: active ? '1px solid var(--accent)' : '1px solid transparent',
                          fontFamily: tf === 'serif' ? 'var(--font-display)' : 'var(--font-body)',
                          fontSize: 13,
                          color: active ? 'var(--text)' : 'var(--text-dim)',
                        }}
                      >
                        {tf === 'serif' ? 'Serif' : 'Sans'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                Zoom
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => onZoomChange(Math.max(0.6, +(zoom - 0.1).toFixed(2)))}
                  style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-alt)', border: 'none', fontSize: 15, color: 'var(--text-dim)' }}
                >
                  −
                </button>
                <input
                  type="range"
                  min={0.6}
                  max={2}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => onZoomChange(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
                <button
                  onClick={() => onZoomChange(Math.min(2, +(zoom + 0.1).toFixed(2)))}
                  style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-alt)', border: 'none', fontSize: 15, color: 'var(--text)' }}
                >
                  +
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>{Math.round(zoom * 100)}%</div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
