import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'framer-motion';
import { springSettle } from '../motion/springs';

interface ProgressBarProps {
  percent: number;
  label: string;
  onSeek?: (percent: number) => void;
}

export default function ProgressBar({ percent, label, onSeek }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, percent));
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState(clamped);

  const percentFromEvent = (e: ReactPointerEvent) => {
    const track = trackRef.current;
    if (!track) return clamped;
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!onSeek) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = percentFromEvent(e);
    setDragging(true);
    setDragPercent(p);
    onSeek(p);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging) return;
    const p = percentFromEvent(e);
    setDragPercent(p);
    onSeek?.(p);
  };

  const onPointerUp = () => setDragging(false);

  const shown = dragging ? dragPercent : clamped;

  return (
    <div style={{ padding: '14px 40px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Hit-area wrapper is taller than the visible track so the bar stays easy to grab. */}
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: 'relative',
          height: 24,
          display: 'flex',
          alignItems: 'center',
          cursor: onSeek ? 'pointer' : 'default',
          touchAction: 'none',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: 4, borderRadius: 2, background: 'var(--divider)' }}>
          <motion.div
            animate={dragging ? { width: `${shown * 100}%` } : { width: `${clamped * 100}%` }}
            transition={dragging ? { duration: 0 } : springSettle}
            style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 2, background: 'var(--accent)' }}
          />
          <motion.div
            animate={dragging ? { left: `${shown * 100}%` } : { left: `${clamped * 100}%` }}
            transition={dragging ? { duration: 0 } : springSettle}
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: 'var(--page-bg)',
              border: '3px solid var(--accent)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)' }}>
        <span>{label}</span>
        <span>{Math.round(shown * 100)}%</span>
      </div>
    </div>
  );
}
