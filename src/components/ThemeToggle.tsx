import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext';
import { SunIcon, MoonIcon } from './Icons';
import { springSnappy } from '../motion/springs';

export default function ThemeToggle() {
  const { settings, update, resolvedAppTheme } = useSettings();
  const isDark = resolvedAppTheme === 'dark';

  const toggle = () => {
    update({ appTheme: isDark ? 'light' : 'dark' });
  };

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light app theme' : 'Switch to dark app theme'}
      title={settings.appTheme === 'system' ? 'Following system — click to set manually' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        width: '100%',
        whiteSpace: 'nowrap',
        padding: '8px 8px',
        border: 'none',
        background: 'transparent',
        color: 'var(--sidebar-fg-dim)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDark ? 'moon' : 'sun'}
            initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 60, opacity: 0, scale: 0.6 }}
            transition={springSnappy}
            style={{ display: 'flex' }}
          >
            {isDark ? <MoonIcon size={15} /> : <SunIcon size={15} />}
          </motion.span>
        </AnimatePresence>
        App theme
      </span>
      <span
        style={{
          width: 38,
          height: 22,
          borderRadius: 11,
          background: isDark ? 'var(--accent)' : 'var(--divider)',
          position: 'relative',
          transition: 'background-color 0.3s ease',
        }}
      >
        <motion.span
          layout
          transition={springSnappy}
          style={{
            position: 'absolute',
            top: 2,
            left: isDark ? 18 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,.35)',
          }}
        />
      </span>
    </button>
  );
}
