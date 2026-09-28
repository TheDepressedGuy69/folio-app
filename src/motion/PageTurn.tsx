import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { springSettle } from './springs';

export interface PageTurnHandle {
  next: () => void;
  prev: () => void;
}

interface LeafProps {
  side: 'left' | 'right';
  content: ReactNode;
  back: ReactNode;
  canTurn: boolean;
  dragEnabled: boolean;
  onCommit: () => void | Promise<void>;
  pageBg: string;
  borderRadius: number;
  registerHandle: (h: { turn: () => void }) => void;
}

/**
 * One page of the spread, grabbable and pullable across the spine to flip —
 * press anywhere on the leaf and pull toward (or past) center. Rotates around
 * the spine edge (its inner edge), not its outer edge, like a real bound page.
 */
function Leaf({ side, content, back, canTurn, dragEnabled, onCommit, pageBg, borderRadius, registerHandle }: LeafProps) {
  const progress = useMotionValue(0); // 0 (rest) .. 1 (fully turned)
  const elRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ startX: 0, startProgress: 0, active: false });
  const [dragging, setDragging] = useState(false);

  const isRight = side === 'right';
  const sign = isRight ? -1 : 1;

  const settle = useCallback(
    (target: 0 | 1) => {
      animate(progress, target, {
        ...springSettle,
        onComplete: async () => {
          // Keep the leaf lying on the far side (showing its back) until the
          // new spread has actually loaded, then reset with no visual change.
          try {
            if (target === 1) await onCommit();
          } finally {
            progress.set(0);
          }
        },
      });
    },
    [progress, onCommit],
  );

  registerHandle({ turn: () => canTurn && settle(1) });

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!canTurn || !dragEnabled) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startProgress: progress.get(), active: true };
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current.active || !elRef.current) return;
    const width = elRef.current.offsetWidth || 1;
    const dx = e.clientX - drag.current.startX;
    // Right leaf: pulling LEFT (toward/past the spine) increases progress.
    // Left leaf: pulling RIGHT (toward/past the spine) increases progress.
    const delta = isRight ? -dx : dx;
    const next = drag.current.startProgress + delta / width;
    progress.set(Math.max(0, Math.min(1, next)));
  };

  const onPointerUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
    settle(progress.get() > 0.32 ? 1 : 0);
  };

  const rotate = useTransform(progress, [0, 1], [0, sign * 180]);
  const frontOpacity = useTransform(progress, (v) => (v < 0.5 ? 1 : 0));
  const backOpacity = useTransform(progress, (v) => (v < 0.5 ? 0 : 1));
  const zIndex = useTransform(progress, (v) => (v > 0 ? 6 : 3));
  const foldShadow = useTransform(progress, [0, 1], [0, 0.55]);
  const curlSize = useTransform(progress, [0, 1], [0, 1]);
  const liftShadow = useTransform(progress, [0, 0.5, 1], [0, 0.4, 0]);

  return (
    <motion.div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [isRight ? 'left' : 'right']: '50%',
        width: '50%',
        transformOrigin: isRight ? '0% center' : '100% center',
        rotateY: rotate,
        borderRadius: isRight ? `0 ${borderRadius}px ${borderRadius}px 0` : `${borderRadius}px 0 0 ${borderRadius}px`,
        transformStyle: 'preserve-3d',
        boxShadow: isRight ? '10px 14px 30px rgba(0,0,0,.35)' : '-10px 14px 30px rgba(0,0,0,.35)',
        cursor: canTurn && dragEnabled ? (dragging ? 'grabbing' : 'grab') : 'default',
        touchAction: 'pan-y',
        zIndex,
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Back of the sheet — the neighbouring page, seen once the leaf swings past vertical */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          rotateY: 180,
          opacity: backOpacity,
          overflow: 'hidden',
          background: pageBg,
          borderRadius: isRight ? `${borderRadius}px 0 0 ${borderRadius}px` : `0 ${borderRadius}px ${borderRadius}px 0`,
        }}
      >
        {back}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `linear-gradient(${isRight ? 'to left' : 'to right'}, rgba(0,0,0,.32), rgba(0,0,0,0) 40%)`,
          }}
        />
      </motion.div>

      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          background: pageBg,
          opacity: frontOpacity,
          borderRadius: isRight ? `0 ${borderRadius}px ${borderRadius}px 0` : `${borderRadius}px 0 0 ${borderRadius}px`,
        }}
      >
      {content}

      {/* Fold shadow deepening toward the spine as the leaf lifts */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          background: isRight
            ? 'linear-gradient(to right, rgba(0,0,0,0.5), rgba(0,0,0,0) 38%)'
            : 'linear-gradient(to left, rgba(0,0,0,0.5), rgba(0,0,0,0) 38%)',
          opacity: foldShadow,
          pointerEvents: 'none',
        }}
      />

      {/* Corner curl — the outer corner peels up as the leaf is pulled */}
      <motion.div
        style={{
          position: 'absolute',
          [isRight ? 'right' : 'left']: 0,
          bottom: 0,
          width: useTransform(curlSize, (v) => `${v * 46}%`),
          height: useTransform(curlSize, (v) => `${v * 46}%`),
          background: isRight
            ? 'linear-gradient(225deg, rgba(255,255,255,.9) 0%, rgba(0,0,0,.05) 55%, rgba(0,0,0,0) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,.9) 0%, rgba(0,0,0,.05) 55%, rgba(0,0,0,0) 100%)',
          clipPath: isRight ? 'polygon(100% 100%, 0 100%, 100% 0)' : 'polygon(0 100%, 100% 100%, 0 0)',
          opacity: foldShadow,
          pointerEvents: 'none',
        }}
      />

      {/* Cast shadow of the lifting leaf onto the page underneath */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          background: isRight
            ? 'linear-gradient(to left, rgba(0,0,0,0.3), rgba(0,0,0,0) 30%)'
            : 'linear-gradient(to right, rgba(0,0,0,0.3), rgba(0,0,0,0) 30%)',
          opacity: liftShadow,
          pointerEvents: 'none',
        }}
      />
      </motion.div>
    </motion.div>
  );
}

interface PageTurnProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
  leftBack: ReactNode;
  rightBack: ReactNode;
  leftUnderneath: ReactNode | null;
  rightUnderneath: ReactNode | null;
  canNext: boolean;
  canPrev: boolean;
  onCommitNext: () => void | Promise<void>;
  onCommitPrev: () => void | Promise<void>;
  pageBg: string;
  borderRadius?: number;
  dragEnabled?: boolean;
}

/**
 * A two-page spread with an independent, press-and-pull page-turn on each
 * side: grab the right page and pull it left (past the spine) to advance;
 * grab the left page and pull it right to go back. Each leaf rotates around
 * the spine, not its outer edge, and is also drivable programmatically via
 * the ref so click/keyboard nav plays the same motion.
 */
const PageTurn = forwardRef<PageTurnHandle, PageTurnProps>(function PageTurn(
  {
    leftContent,
    rightContent,
    leftBack,
    rightBack,
    leftUnderneath,
    rightUnderneath,
    canNext,
    canPrev,
    onCommitNext,
    onCommitPrev,
    pageBg,
    borderRadius = 4,
    dragEnabled = true,
  },
  ref,
) {
  const rightHandleRef = useRef<{ turn: () => void } | null>(null);
  const leftHandleRef = useRef<{ turn: () => void } | null>(null);

  useImperativeHandle(ref, () => ({
    next: () => rightHandleRef.current?.turn(),
    prev: () => leftHandleRef.current?.turn(),
  }));

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        perspective: 2600,
      }}
    >
      {/* Underneath layer: the neighboring spread's pages, revealed as leaves lift */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: '50%', width: '50%', overflow: 'hidden', background: pageBg, borderRadius: `${borderRadius}px 0 0 ${borderRadius}px`, zIndex: 1 }}>
        {leftUnderneath}
      </div>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '50%', overflow: 'hidden', background: pageBg, borderRadius: `0 ${borderRadius}px ${borderRadius}px 0`, zIndex: 1 }}>
        {rightUnderneath}
      </div>

      {/* Spine shadow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          width: 22,
          transform: 'translateX(-50%)',
          background:
            'linear-gradient(to right, rgba(0,0,0,0.18), rgba(0,0,0,0.04) 30%, rgba(0,0,0,0.04) 70%, rgba(0,0,0,0.18))',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      <Leaf
        side="left"
        content={leftContent}
        back={leftBack}
        canTurn={canPrev}
        dragEnabled={dragEnabled}
        onCommit={onCommitPrev}
        pageBg={pageBg}
        borderRadius={borderRadius}
        registerHandle={(h) => {
          leftHandleRef.current = h;
        }}
      />
      <Leaf
        side="right"
        content={rightContent}
        back={rightBack}
        canTurn={canNext}
        dragEnabled={dragEnabled}
        onCommit={onCommitNext}
        pageBg={pageBg}
        borderRadius={borderRadius}
        registerHandle={(h) => {
          rightHandleRef.current = h;
        }}
      />
    </div>
  );
});

export default PageTurn;
