import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import ePub from 'epubjs';
import type Book from 'epubjs/types/book';
import type Rendition from 'epubjs/types/rendition';
import { applyTheme } from './EpubReader';
import { HIGHLIGHT_COLORS, READING_THEME_COLORS } from '../lib/types';
import type { EpubReaderProps, ReaderHandle } from './readerTypes';

// Scroll mode gets a wide, tall view; a centered readable column with slightly larger
// type keeps lines from stretching edge to edge and the text from looking tiny.
const SCROLL_FONT_BOOST = 1.25;

function applyScrollTheme(
  rendition: Rendition,
  bg: string,
  fg: string,
  fontSize: number,
  typeface: 'serif' | 'sans',
) {
  applyTheme(rendition, bg, fg, fontSize * SCROLL_FONT_BOOST, typeface);
  rendition.themes.default({
    body: {
      'max-width': '40em',
      margin: '0 auto !important',
      padding: '28px 24px !important',
    },
  });
}

const EpubScrollReader = forwardRef<ReaderHandle, EpubReaderProps>(function EpubScrollReader(
  { data, initialLocation, mode, readingTheme, fontSize, typeface, highlights, onProgress, onSelection },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [ready, setReady] = useState(false);

  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const theme = READING_THEME_COLORS[readingTheme];

  const applyHighlights = (rendition: Rendition) => {
    try {
      // @ts-expect-error - internal map, not fully typed
      const existing = Object.keys(rendition.annotations?._annotations ?? {});
      for (const key of existing) {
        const [type, cfiRange] = key.split(',');
        if (type === 'highlight') rendition.annotations.remove(cfiRange, 'highlight');
      }
    } catch {
      // ignore
    }
    for (const h of highlights) {
      try {
        rendition.annotations.add(
          'highlight',
          h.cfiRange,
          {},
          undefined,
          'epub-highlight',
          { fill: HIGHLIGHT_COLORS[h.color], 'fill-opacity': '0.5', 'mix-blend-mode': 'multiply' },
        );
      } catch {
        // section for this cfi isn't rendered yet — epub.js will skip it, fine
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    const book = ePub(data.slice(0));
    bookRef.current = book;

    (async () => {
      await book.opened;
      // Generated in the background so rendering never waits on it; progress % is refreshed once ready.
      book.locations
        .generate(1600)
        .then(() => {
          const cfi = (renditionRef.current as any)?.location?.start?.cfi as string | undefined;
          if (cancelled || !cfi) return;
          onProgress({ location: cfi, percent: book.locations.percentageFromCfi(cfi) ?? 0 });
        })
        .catch(() => {
          // progress % just won't be exact for odd books; navigation still works
        });
      if (cancelled || !wrapperRef.current) return;

      const rendition = book.renderTo(wrapperRef.current, {
        width: '100%',
        height: '100%',
        flow: 'scrolled-doc',
        manager: 'continuous',
        allowScriptedContent: false,
      } as any);
      renditionRef.current = rendition;

      applyScrollTheme(rendition, theme.bg, theme.fg, fontSize, typeface);

      rendition.on('rendered', () => applyHighlights(rendition));
      rendition.on('selected', (cfiRange: string, contents: any) => {
        if (modeRef.current !== 'highlight') return;
        const text = contents?.window?.getSelection?.()?.toString?.() ?? '';
        if (text.trim()) onSelection({ text, cfiRange });
      });
      rendition.on('relocated', (location: any) => {
        const cfi = location?.start?.cfi;
        if (!cfi) return;
        let percent = 0;
        try {
          percent = book.locations.percentageFromCfi(cfi) ?? 0;
        } catch {
          percent = 0;
        }
        onProgress({ location: cfi, percent });
      });

      await rendition.display(initialLocation || undefined);
      if (!cancelled) setReady(true);
    })().catch((err) => console.error('Folio: epub scroll load failed', err));

    return () => {
      cancelled = true;
      renditionRef.current?.destroy();
      // epub.js still runs resources.replaceCss() after open; destroying earlier throws
      Promise.resolve(book.opened).catch(() => {}).then(() => book.destroy());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (rendition) applyScrollTheme(rendition, theme.bg, theme.fg, fontSize, typeface);
  }, [theme.bg, theme.fg, fontSize, typeface]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (rendition) applyHighlights(rendition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights]);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      clearTimeout(raf);
      raf = window.setTimeout(async () => {
        const rendition = renditionRef.current;
        if (!rendition) return;
        // Resizing reflows the whole book; remember where we were and go back there
        // so the reading position (and the progress saved from it) doesn't drift.
        const cfi = (rendition as any).location?.start?.cfi as string | undefined;
        try {
          rendition.resize('100%' as any, '100%' as any);
          if (cfi) await rendition.display(cfi);
        } catch {
          // ignore — resize is best-effort
        }
      }, 200);
    });
    ro.observe(el);
    return () => {
      clearTimeout(raf);
      ro.disconnect();
    };
  }, []);

  // The continuous manager lays the whole book out as one tall scrollable
  // column — it has no notion of a discrete "page" the way the paginated
  // manager does, so rendition.next()/prev() (built for pagination) jump by
  // a full container-height "page" that, for a short book, can overshoot
  // straight to the end. Scroll the manager's own scroll container by one
  // screen instead, same as the PDF continuous view does.
  const getScrollEl = () => wrapperRef.current?.querySelector('.epub-container') as HTMLElement | null;

  useImperativeHandle(ref, () => ({
    next: () => {
      const el = getScrollEl();
      el?.scrollBy({ top: el.clientHeight * 0.92, behavior: 'smooth' });
    },
    prev: () => {
      const el = getScrollEl();
      el?.scrollBy({ top: -el.clientHeight * 0.92, behavior: 'smooth' });
    },
    goTo: (loc: string) => {
      renditionRef.current?.display(loc);
    },
    goToPercent: (percent: number) => {
      const book = bookRef.current;
      const rendition = renditionRef.current;
      if (!book || !rendition) return;
      try {
        const cfi = book.locations.cfiFromPercentage(Math.max(0, Math.min(1, percent)));
        if (cfi) rendition.display(cfi);
      } catch (err) {
        console.error('Folio: epub scroll percent seek failed', err);
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
        // The continuous manager creates its own internally-scrolling
        // '.epub-container' child sized to 100% — this wrapper must not also
        // scroll, or two nested scrollers fight over wheel/trackpad input.
        overflow: 'hidden',
        opacity: ready ? 1 : 0,
        background: theme.bg,
        borderRadius: 6,
      }}
    >
      {mode === 'highlight' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: 'inset 0 0 0 2px rgba(60,110,99,0.4)',
            borderRadius: 6,
            zIndex: 5,
          }}
        />
      )}
    </div>
  );
});

export default EpubScrollReader;
