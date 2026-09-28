import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LibraryIcon, SettingsIcon } from './Icons';
import { springPill } from '../motion/springs';

const NAV_ITEMS = [{ to: '/', label: 'Library', icon: LibraryIcon }];

function NavLink({ to, label, icon: Icon, active }: { to: string; label: string; icon: typeof LibraryIcon; active: boolean }) {
  return (
    <Link
      to={to}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        color: active ? 'var(--sidebar-fg-strong)' : 'var(--sidebar-fg-dim)',
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        textDecoration: 'none',
        transition: 'color 0.15s ease',
      }}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active"
          transition={springPill}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--sidebar-active-bg)',
            borderRadius: 'var(--radius-sm)',
            zIndex: 0,
          }}
        />
      )}
      <Icon size={17} style={{ position: 'relative', zIndex: 1 }} />
      <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const location = useLocation();

  return (
    <div
      style={{
        width: 224,
        flex: '0 0 224px',
        boxSizing: 'border-box',
        background: 'var(--sidebar-bg)',
        color: 'var(--sidebar-fg)',
        display: 'flex',
        flexDirection: 'column',
        padding: '26px 16px',
        gap: 30,
        borderRight: '1px solid var(--divider)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <path d="M4 4h9a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4V4z" fill="var(--sidebar-bg)" opacity={0.92} />
            <path d="M20 4h-9a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h10V4z" fill="var(--sidebar-bg)" opacity={0.62} />
          </svg>
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 18.5, fontWeight: 600, color: 'var(--sidebar-fg-strong)', letterSpacing: '-0.01em' }}>
          Folio
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} label={item.label} icon={item.icon} active={location.pathname === item.to} />
        ))}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 1, background: 'var(--divider)', margin: '0 4px 10px' }} />
        <NavLink to="/settings" label="Settings" icon={SettingsIcon} active={location.pathname === '/settings'} />
      </div>
    </div>
  );
}
