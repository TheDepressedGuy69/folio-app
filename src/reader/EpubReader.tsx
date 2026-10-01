import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import ePub from 'epubjs';
import type Book from 'epubjs/types/book';
import type Rendition from 'epubjs/types/rendition';
import PageTurn, { type PageTurnHandle } from '../motion/PageTurn';
import { HIGHLIGHT_COLORS, READING_THEME_COLORS } from '../lib/types';
import type { EpubReaderProps, ReaderHandle } from './readerTypes';

function renditionOpts(width: number, height: number) {
  return {
    width,
    height,
    flow: 'paginated' as const,
    spread: 'none' as const,
    allowScriptedContent: false,
  };
}

export function applyTheme(
  rendition: Rendition,
  bg: string,
  fg: string,
  fontSize: number,
  typeface: 'serif' | 'sans',
) {
  rendition.themes.default({
    html: {
      margin: '0 !important',
      padding: '0 !important',
    },
    body: {
      background: `${bg} !important`,
      color: `${fg} !important`,
      'font-family':
        typeface === 'serif'
          ? "'Fraunces', Georgia, serif !important"
          : "'Source Sans 3', system-ui, sans-serif !important",
      margin: '0 !important',
      padding: '28px 10px !important',
      'box-sizing': 'border-box',
      '-webkit-font-smoothing': 'antialiased',
      '-moz-osx-font-smoothing': 'grayscale',
      'text-rendering': 'optimizeLegibility',
    },
    '::selection': { background: 'rgba(243,217,140,0.6)' },
  });
  rendition.themes.fontSize(`${fontSize}%`);
}

/**
 * Run a navigation, then read the resulting location directly. epub.js's
 * "relocated" event is debounced and doesn't fire when a rendition is asked
 * to show where it already is, so awaiting the navigation promise and reading
 * currentLocation() is the reliable route.
 */
async function navigate(rendition: Rendition, run: () => Promise<unknown> | void): Promise<any> {
  const guard = new Promise((r) => setTimeout(r, 10000));
  try {
    await Promise.race([Promise.resolve(run()), guard]);
  } catch {
    // fall through and read whatever location the rendition is at
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    await new Promise((r) => setTimeout(r, attempt === 0 ? 30 : 150));
    try {
      const loc = (rendition as any).currentLocation();
      if (loc?.start?.cfi) return loc;
    } catch {
      // not ready yet
    }
  }
  return undefined;
}
const stepTo = (rendition: Rendition, cfi: string | undefined) => navigate(rendition, () => rendition.display(cfi));
const stepNext = (rendition: Rendition) => navigate(rendition, () => rendition.next());
const stepPrev = (rendition: Rendition) => navigate(rendition, () => rendition.prev());

const EpubReader = forwardRef<ReaderHandle, EpubReaderProps>(function EpubReader(
  { data, initialLocation, mode, readingTheme, fontSize, typeface, highlights, onProgress, onSelection },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const leftDivRef = useRef<HTMLDivElement>(null);
  const rightDivRef = useRef<HTMLDivElement>(null);
  const underRightDivRef = useRef<HTMLDivElement>(null);
  const rightBackDivRef = useRef<HTMLDivElement>(null);
  const leftBackDivRef = useRef<HTMLDivElement>(null);
  const underLeftDivRef = useRef<HTMLDivElement>(null);
  const pageTurnRef = useRef<PageTurnHandle>(null);
  const sizeRef = useRef({ width: 300, height: 700 });

  const bookRef = useRef<Book | null>(null);
  const leftRef = useRef<Rendition | null>(null);
  const rightRef = useRef<Rendition | null>(null);
  const underRightRef = useRef<Rendition | null>(null);
  const rightBackRef = useRef<Rendition | null>(null);
  const leftBackRef = useRef<Rendition | null>(null);
  const underLeftRef = useRef<Rendition | null>(null);

  const leftCfiRef = useRef<string | undefined>(initialLocation);
  const rightCfiRef = useRef<string | undefined>(undefined);
  const underRightCfiRef = useRef<string | undefined>(undefined);
  const rightBackCfiRef = useRef<string | undefined>(undefined);
  const leftBackCfiRef = useRef<string | undefined>(undefined);
  const underLeftCfiRef = useRef<string | undefined>(undefined);

  const [hasNext, setHasNext] = useState(true);
  const [hasPrev, setHasPrev] = useState(true);
  const [ready, setReady] = useState(false);
  const [renderTick, setRenderTick] = useState(0);

  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const theme = READING_THEME_COLORS[readingTheme];

  useEffect(() => {
    for (const r of allRenditions()) {
      if (r) applyTheme(r, theme.bg, theme.fg, fontSize, typeface);
    }
  }, [theme.bg, theme.fg, fontSize, typeface, renderTick]);

  useEffect(() => {
    for (const r of [leftRef.current, rightRef.current]) {
      if (!r) continue;
      try {
        // @ts-expect-error - annotations internal map is not fully typed
        const existing = Object.keys(r.annotations?._annotations ?? {});
        for (const key of existing) {
          const [type, cfiRange] = key.split(',');
          if (type === 'highlight') r.annotations.remove(cfiRange, 'highlight');
        }
      } catch {
        // ignore
      }
      for (const h of highlights) {
        r.annotations.add(
          'highlight',
          h.cfiRange,
          {},
          undefined,
          'epub-highlight',
          { fill: HIGHLIGHT_COLORS[h.color], 'fill-opacity': '0.5', 'mix-blend-mode': 'multiply' },
        );
      }
    }
  }, [highlights, renderTick]);

  function allRenditions() {
    return [
      leftRef.current,
      rightRef.current,
      rightBackRef.current,
      underRightRef.current,
      leftBackRef.current,
      underLeftRef.current,
    ];
  }

  async function syncAll(newLeftCfi: string | undefined) {
    const book = bookRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    const rightBack = rightBackRef.current;
    const underRight = underRightRef.current;
    const leftBack = leftBackRef.current;
    const underLeft = underLeftRef.current;
    if (!book || !left || !right || !rightBack || !underRight || !leftBack || !underLeft) return;

    const leftLoc = await stepTo(left, newLeftCfi);
    const leftCfi = leftLoc?.start?.cfi;
    leftCfiRef.current = leftCfi;

    let percent = 0;
    try {
      percent = leftCfi ? (book.locations.percentageFromCfi(leftCfi) ?? 0) : 0;
    } catch {
      percent = 0;
    }
    if (leftCfi) onProgress({ location: leftCfi, percent });

    // Forward chain: left -> right -> rightBack (back of the right leaf) -> underRight
    const forward = async (target: Rendition, from: string) => {
      await stepTo(target, from);
      const loc = await stepNext(target);
      const cfi = loc?.start?.cfi as string | undefined;
      return cfi && cfi !== from ? cfi : undefined;
    };
    const backward = async (target: Rendition, from: string) => {
      await stepTo(target, from);
      const loc = await stepPrev(target);
      const cfi = loc?.start?.cfi as string | undefined;
      return cfi && cfi !== from ? cfi : undefined;
    };

    let rightCfi: string | undefined;
    let rightBackCfi: string | undefined;
    let underRightCfi: string | undefined;
    if (leftCfi && !leftLoc?.atEnd) rightCfi = await forward(right, leftCfi);
    if (rightCfi) rightBackCfi = await forward(rightBack, rightCfi);
    if (rightBackCfi) underRightCfi = await forward(underRight, rightBackCfi);
    rightCfiRef.current = rightCfi;
    rightBackCfiRef.current = rightBackCfi;
    underRightCfiRef.current = underRightCfi;
    setHasNext(Boolean(rightBackCfi));

    let leftBackCfi: string | undefined;
    let underLeftCfi: string | undefined;
    if (leftCfi && !leftLoc?.atStart) leftBackCfi = await backward(leftBack, leftCfi);
    if (leftBackCfi) underLeftCfi = await backward(underLeft, leftBackCfi);
    leftBackCfiRef.current = leftBackCfi;
    underLeftCfiRef.current = underLeftCfi;
    setHasPrev(Boolean(leftBackCfi));

    setRenderTick((t) => t + 1);
  }

  useEffect(() => {
    let cancelled = false;
    const book = ePub(data.slice(0));
    bookRef.current = book;

    (async () => {
      await book.ready;
      try {
        await book.locations.generate(1600);
      } catch {
        // large/odd books: progress % just won't be exact, navigation still works
      }
      if (
        cancelled ||
        !leftDivRef.current ||
        !rightDivRef.current ||
        !underRightDivRef.current ||
        !rightBackDivRef.current ||
        !leftBackDivRef.current ||
        !underLeftDivRef.current ||
        !wrapperRef.current
      )
        return;

      const rect = wrapperRef.current.getBoundingClientRect();
      sizeRef.current = { width: Math.round(rect.width / 2) || 300, height: Math.round(rect.height) || 700 };
      const { width, height } = sizeRef.current;

      const left = book.renderTo(leftDivRef.current, renditionOpts(width, height));
      const right = book.renderTo(rightDivRef.current, renditionOpts(width, height));
      const underRight = book.renderTo(underRightDivRef.current, renditionOpts(width, height));
      const underLeft = book.renderTo(underLeftDivRef.current, renditionOpts(width, height));
      const rightBack = book.renderTo(rightBackDivRef.current, renditionOpts(width, height));
      const leftBack = book.renderTo(leftBackDivRef.current, renditionOpts(width, height));
      leftRef.current = left;
      rightRef.current = right;
      underRightRef.current = underRight;
      underLeftRef.current = underLeft;
      rightBackRef.current = rightBack;
      leftBackRef.current = leftBack;

      for (const r of [left, right, underRight, underLeft, rightBack, leftBack]) {
        applyTheme(r, theme.bg, theme.fg, fontSize, typeface);
      }

      for (const r of [left, right]) {
        r.on('selected', (cfiRange: string, contents: any) => {
          if (modeRef.current !== 'highlight') return;
          const text = contents?.window?.getSelection?.()?.toString?.() ?? '';
          if (text.trim()) onSelection({ text, cfiRange });
        });
      }

      await syncAll(initialLocation || undefined);
      if (!cancelled) setReady(true);
    })().catch((err) => console.error('Folio: epub load failed', err));

    return () => {
      cancelled = true;
      leftRef.current?.destroy();
      rightRef.current?.destroy();
      underRightRef.current?.destroy();
      underLeftRef.current?.destroy();
      rightBackRef.current?.destroy();
      leftBackRef.current?.destroy();
      book.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Re-layout when the reader's container changes size (e.g. entering/leaving
  // fullscreen) — resize all four renditions, then re-sync pagination since
  // page boundaries shift with the new page dimensions.
  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const left = leftRef.current;
        const right = rightRef.current;
        const underRight = underRightRef.current;
        const underLeft = underLeftRef.current;
        if (!left || !right || !underRight || !underLeft || !rightBackRef.current || !leftBackRef.current) return;
        const rect = el.getBoundingClientRect();
        const width = Math.round(rect.width / 2) || sizeRef.current.width;
        const height = Math.round(rect.height) || sizeRef.current.height;
        if (width === sizeRef.current.width && height === sizeRef.current.height) return;
        sizeRef.current = { width, height };
        for (const r of allRenditions()) r?.resize(width, height);
        syncAll(leftCfiRef.current).catch((err) => console.error('Folio: epub resize re-sync failed', err));
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitNext = async () => {
    if (rightBackCfiRef.current) await syncAll(rightBackCfiRef.current);
  };

  const commitPrev = async () => {
    const target = underLeftCfiRef.current ?? leftBackCfiRef.current;
    if (target) await syncAll(target);
  };

  useImperativeHandle(ref, () => ({
    next: () => pageTurnRef.current?.next(),
    prev: () => pageTurnRef.current?.prev(),
    goTo: async (loc: string) => {
      await syncAll(loc);
    },
    goToPercent: async (percent: number) => {
      const book = bookRef.current;
      if (!book) return;
      try {
        const cfi = book.locations.cfiFromPercentage(Math.max(0, Math.min(1, percent)));
        if (cfi) await syncAll(cfi);
      } catch (err) {
        console.error('Folio: epub percent seek failed', err);
      }
    },
    search: async (query: string) => {
      const book = bookRef.current;
      const q = query.trim();
      if (!book || !q) return [];
      const results: { id: string; location: string; excerpt: string }[] = [];
      const items = (book.spine as any).spineItems as any[];
      for (const item of items) {
        try {
          await item.load(book.load.bind(book));
          const matches = item.search(q) as { cfi: string; excerpt: string }[];
          for (const m of matches) {
            results.push({ id: m.cfi, location: m.cfi, excerpt: m.excerpt.trim() });
          }
        } catch {
          // section failed to load/parse — skip it
        } finally {
          item.unload();
        }
        if (results.length >= 40) break;
      }
      return results;
    },
  }));

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        opacity: ready ? 1 : 0,
        pointerEvents: mode === 'highlight' ? 'auto' : 'none',
      }}
    >
      <PageTurn
        ref={pageTurnRef}
        dragEnabled={mode !== 'highlight'}
        pageBg={theme.bg}
        leftContent={<div ref={leftDivRef} style={{ width: '100%', height: '100%' }} />}
        rightContent={<div ref={rightDivRef} style={{ width: '100%', height: '100%' }} />}
        leftBack={<div ref={leftBackDivRef} style={{ width: '100%', height: '100%' }} />}
        rightBack={<div ref={rightBackDivRef} style={{ width: '100%', height: '100%' }} />}
        leftUnderneath={<div ref={underLeftDivRef} style={{ width: '100%', height: '100%', display: hasPrev ? 'block' : 'none' }} />}
        rightUnderneath={<div ref={underRightDivRef} style={{ width: '100%', height: '100%', display: hasNext ? 'block' : 'none' }} />}
        canNext={hasNext}
        canPrev={hasPrev}
        onCommitNext={commitNext}
        onCommitPrev={commitPrev}
      />
      {mode === 'highlight' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: 'inset 0 0 0 2px rgba(60,110,99,0.4)',
            borderRadius: 6,
          }}
        />
      )}
    </div>
  );
});

export default EpubReader;
