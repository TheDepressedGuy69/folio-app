import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { type PDFDocumentProxy } from 'pdfjs-dist';
import { PageSlot, READING_FILTER } from './PdfReader';
import { HIGHLIGHT_COLORS, READING_THEME_COLORS } from '../lib/types';
import type { PdfReaderProps, ReaderHandle } from './readerTypes';
import '../lib/pdfWorker';

/** One page row — mounts its PageSlot lazily once scrolled near, and stays mounted after.
 *  Always reserves the page's final pixel size (even before it mounts) so the
 *  container's total scroll height never jumps as pages mount — otherwise the
 *  page the user is looking at keeps shifting underneath them while scrolling. */
function ScrollRow({
  pageNum,
  pdf,
  scale,
  width,
  height,
  mode,
  readingTheme,
  highlights,
  onTextLayerReady,
  onNavigate,
  rowRef,
}: {
  pageNum: number;
  pdf: PDFDocumentProxy | null;
  scale: number;
  width: number;
  height: number;
  mode: 'read' | 'highlight';
  readingTheme: PdfReaderProps['readingTheme'];
  highlights: PdfReaderProps['highlights'];
  onTextLayerReady: (container: HTMLDivElement, pageNum: number) => void;
  onNavigate: (page: number) => void;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  const [visible, setVisible] = useState(false);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: '1000px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div
      ref={(el) => {
        elRef.current = el;
        rowRef(el);
      }}
      data-page={pageNum}
      style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}
    >
      <div style={{ position: 'relative', width: width || undefined, minHeight: height || undefined }}>
        {visible && width > 0 && (
          <>
            <PageSlot
              pdf={pdf}
              pageNum={pageNum}
              scale={scale}
              interactive
              textLayerActive={mode === 'highlight'}
              linksActive={mode === 'read'}
              filter={READING_FILTER[readingTheme]}
              onTextLayerReady={onTextLayerReady}
              onNavigate={onNavigate}
            />
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {highlights
                .filter((h) => h.page === pageNum)
                .flatMap((h) =>
                  h.rects.map((r, i) => (
                    <div
                      key={`${h.id}-${i}`}
                      style={{
                        position: 'absolute',
                        left: `${r.x * 100}%`,
                        top: `${r.y * 100}%`,
                        width: `${r.w * 100}%`,
                        height: `${r.h * 100}%`,
                        background: HIGHLIGHT_COLORS[h.color],
                        opacity: 0.5,
                        mixBlendMode: 'multiply',
                        borderRadius: 2,
                      }}
                    />
                  )),
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const PdfScrollReader = forwardRef<ReaderHandle, PdfReaderProps>(function PdfScrollReader(
  { data, initialLocation, mode, readingTheme, zoom, highlights, onProgress, onSelection },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [fitScale, setFitScale] = useState(0);
  const naturalWidthRef = useRef(0);
  const naturalHeightRef = useRef(0);
  const currentPageRef = useRef(Number(initialLocation) || 1);
  const pendingInitialScroll = useRef(true);
  const theme = READING_THEME_COLORS[readingTheme];

  const computeFitWidth = (el: HTMLElement) => ((el.clientWidth - 24) * 0.96) / (naturalWidthRef.current || 1);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
    (async () => {
      const doc = await loadingTask.promise;
      if (cancelled) return;
      setPdf(doc);
      setNumPages(doc.numPages);
      const page = await doc.getPage(1);
      const natural = page.getViewport({ scale: 1 });
      naturalWidthRef.current = natural.width;
      naturalHeightRef.current = natural.height;
      if (containerRef.current) setFitScale(computeFitWidth(containerRef.current));
    })();
    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!naturalWidthRef.current) return;
        setFitScale(computeFitWidth(el));
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const scale = fitScale * zoom;
  const pageWidth = Math.round(naturalWidthRef.current * scale);
  const pageHeight = Math.round(naturalHeightRef.current * scale);

  // Jump to the saved/requested page once pages exist to scroll to.
  useEffect(() => {
    if (!pendingInitialScroll.current || !numPages || scale <= 0) return;
    const target = Math.max(1, Math.min(numPages, Number(initialLocation) || 1));
    const row = rowsRef.current.get(target);
    if (row) {
      row.scrollIntoView({ block: 'start' });
      pendingInitialScroll.current = false;
    }
  }, [numPages, scale, initialLocation]);

  // Track which page is topmost in the viewport to report reading progress.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const anchor = el.getBoundingClientRect().top + 40;
        let best = currentPageRef.current;
        let bestDist = Infinity;
        for (const [p, node] of rowsRef.current) {
          const rect = node.getBoundingClientRect();
          // Prefer the row that actually contains the anchor line; fall back
          // to whichever row's top is closest to it (e.g. during fast scroll).
          if (rect.top <= anchor && rect.bottom > anchor) {
            best = p;
            bestDist = -1;
            break;
          }
          const dist = Math.abs(rect.top - anchor);
          if (dist < bestDist) {
            bestDist = dist;
            best = p;
          }
        }
        if (best !== currentPageRef.current) currentPageRef.current = best;
        onProgress({
          location: String(best),
          percent: numPages ? (best - 1) / Math.max(1, numPages - 1) : 0,
          total: numPages,
        });
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [numPages, onProgress]);

  const handleTextLayerReady = useCallback(
    (container: HTMLDivElement, forPage: number) => {
      const onUp = () => {
        if (mode !== 'highlight') return;
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
        const text = selection.toString();
        if (!text.trim()) return;
        const range = selection.getRangeAt(0);
        const rects = Array.from(range.getClientRects());
        const containerRect = container.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) return;
        const normRects = rects.map((r) => ({
          x: (r.left - containerRect.left) / containerRect.width,
          y: (r.top - containerRect.top) / containerRect.height,
          w: r.width / containerRect.width,
          h: r.height / containerRect.height,
        }));
        onSelection({ text, page: forPage, rects: normRects });
      };
      container.addEventListener('pointerup', onUp);
    },
    [mode, onSelection],
  );

  const scrollToPage = useCallback((n: number, smooth = true) => {
    const row = rowsRef.current.get(n);
    row?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useImperativeHandle(ref, () => ({
    next: () => {
      const el = containerRef.current;
      el?.scrollBy({ top: el.clientHeight * 0.92, behavior: 'smooth' });
    },
    prev: () => {
      const el = containerRef.current;
      el?.scrollBy({ top: -el.clientHeight * 0.92, behavior: 'smooth' });
    },
    goTo: (loc: string) => {
      const n = Number(loc);
      if (Number.isFinite(n)) scrollToPage(Math.max(1, Math.min(numPages || n, n)), false);
    },
    goToPercent: (percent: number) => {
      if (!numPages) return;
      const n = Math.round(percent * (numPages - 1)) + 1;
      scrollToPage(Math.max(1, Math.min(numPages, n)), false);
    },
    search: async (query: string) => {
      const q = query.trim();
      if (!pdf || !q) return [];
      const lowerQ = q.toLowerCase();
      const results: { id: string; location: string; excerpt: string; label: string }[] = [];
      for (let i = 1; i <= numPages && results.length < 40; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map((it: any) => it.str).join(' ');
        const lowerText = text.toLowerCase();
        let idx = lowerText.indexOf(lowerQ);
        while (idx !== -1 && results.length < 40) {
          const start = Math.max(0, idx - 60);
          const end = Math.min(text.length, idx + q.length + 60);
          const excerpt = `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
          results.push({ id: `${i}-${idx}`, location: String(i), excerpt, label: `Page ${i}` });
          idx = lowerText.indexOf(lowerQ, idx + q.length);
        }
      }
      return results;
    },
  }));

  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div
      ref={containerRef}
      className="scroll-y"
      style={{ width: '100%', height: '100%', overflowY: 'auto', background: theme.bg, borderRadius: 6 }}
    >
      {pages.map((n) => (
        <ScrollRow
          key={n}
          pageNum={n}
          pdf={pdf}
          scale={scale}
          width={pageWidth}
          height={pageHeight}
          mode={mode}
          readingTheme={readingTheme}
          highlights={highlights}
          onTextLayerReady={handleTextLayerReady}
          onNavigate={(p) => scrollToPage(p, true)}
          rowRef={(el) => {
            if (el) rowsRef.current.set(n, el);
            else rowsRef.current.delete(n);
          }}
        />
      ))}
    </div>
  );
});

export default PdfScrollReader;
