import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import { useSettings } from '../context/SettingsContext';
import { useLibrary } from '../context/LibraryContext';
import { estimateStorage, getStorageLocation } from '../lib/db';
import { READING_THEME_COLORS } from '../lib/types';
import type { AppTheme, ReadingTheme, Typeface } from '../lib/types';
import { springSnappy } from '../motion/springs';

const APP_THEMES: { key: AppTheme; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
];

const READING_THEMES: { key: ReadingTheme; label: string }[] = [
  { key: 'paper', label: 'Paper' },
  { key: 'sepia', label: 'Sepia' },
  { key: 'dusk', label: 'Dusk' },
  { key: 'night', label: 'Night' },
];

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

export default function Settings() {
  const { settings, update } = useSettings();
  const { books } = useLibrary();
  const [storage, setStorage] = useState({ usage: 0, quota: 0 });
  const [storagePath, setStoragePath] = useState<string | null>(null);

  useEffect(() => {
    estimateStorage().then(setStorage);
  }, [books.length]);

  useEffect(() => {
    getStorageLocation().then(setStoragePath);
  }, []);

  const usagePercent = storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;

  return (
    <div className="app-shell">
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ padding: '32px 44px 24px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}>Settings</div>
        </div>

        <div className="scroll-y" style={{ flex: 1, padding: '0 44px 36px', display: 'flex', gap: 28 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <Card title="App appearance">
              <div style={{ display: 'flex', gap: 12 }}>
                {APP_THEMES.map((t) => {
                  const active = settings.appTheme === t.key;
                  return (
                    <motion.button
                      key={t.key}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => update({ appTheme: t.key })}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        padding: '14px 0 12px',
                        borderRadius: 10,
                        border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--divider)',
                        background: active ? 'var(--bg-alt)' : 'transparent',
                      }}
                    >
                      <div
                        style={{
                          width: 56,
                          height: 38,
                          borderRadius: 5,
                          border: '1px solid var(--divider)',
                          background:
                            t.key === 'light'
                              ? '#f7f1e3'
                              : t.key === 'dark'
                                ? '#100d0a'
                                : 'linear-gradient(90deg,#f7f1e3 50%,#100d0a 50%)',
                        }}
                      />
                      <span style={{ fontSize: 12, color: active ? 'var(--text)' : 'var(--text-dim)', fontWeight: active ? 600 : 400 }}>
                        {t.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.5, marginTop: 12 }}>
                Controls the app's own screens — library, toolbars, panels. The book page underneath keeps its own
                reading theme, set below.
              </div>
            </Card>

            <Card title="Default reading theme">
              <div style={{ display: 'flex', gap: 10 }}>
                {READING_THEMES.map((t) => {
                  const active = settings.readingTheme === t.key;
                  const c = READING_THEME_COLORS[t.key];
                  return (
                    <button
                      key={t.key}
                      onClick={() => update({ readingTheme: t.key })}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none' }}
                    >
                      <motion.div
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.94 }}
                        transition={springSnappy}
                        style={{
                          width: 52,
                          height: 66,
                          borderRadius: 6,
                          background: c.bg,
                          border: active ? '2px solid var(--accent)' : '2px solid transparent',
                        }}
                      />
                      <span style={{ fontSize: 11, color: active ? 'var(--text)' : 'var(--text-dim)' }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          <div style={{ width: 340, flex: '0 0 340px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card title="Reading defaults">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Label>Text size</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>A</span>
                  <input
                    type="range"
                    min={70}
                    max={180}
                    step={5}
                    value={settings.fontSize}
                    onChange={(e) => update({ fontSize: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: 17, color: 'var(--text)' }}>A</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                <Label>Typeface</Label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['serif', 'sans'] as Typeface[]).map((tf) => {
                    const active = settings.typeface === tf;
                    return (
                      <button
                        key={tf}
                        onClick={() => update({ typeface: tf })}
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
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Applies to EPUB books — PDF pages are fixed images.</div>
              </div>
            </Card>

            <Card title="Storage">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--text-dim)' }}>
                    {books.length} book{books.length === 1 ? '' : 's'} on this device
                  </span>
                  <span style={{ color: 'var(--text-dim)' }}>{formatBytes(storage.usage)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--divider)', overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${usagePercent}%` }}
                    transition={springSnappy}
                    style={{ height: '100%', background: 'var(--accent)' }}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {storage.quota
                    ? `${formatBytes(storage.usage)} of ${formatBytes(storage.quota)} free disk space used`
                    : `${formatBytes(storage.usage)} used`}
                </div>
                {storagePath && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-faint)', wordBreak: 'break-all' }}>
                    Stored at {storagePath}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>{children}</div>;
}
