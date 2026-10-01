import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { TextLayer, type PDFDocumentProxy } from 'pdfjs-dist';
import PageTurn, { type PageTurnHandle } from '../motion/PageTurn';
import { HIGHLIGHT_COLORS, READING_THEME_COLORS } from '../lib/types';
import type { PdfReaderProps, ReaderHandle } from './readerTypes';
import '../lib/pdfWorker';

export const READING_FILTER: Record<string, string> = {
  paper: 'none',
  sepia: 'sepia(0.35) contrast(0.96)',
  dusk: 'invert(0.86) hue-rotate(180deg) contrast(0.9) brightness(0.95)',
  night: 'invert(0.94) hue-rotate(180deg) contrast(0.85) brightness(0.82)',
};

interface PdfLink {
  rect: { x: number; y: number; w: number; h: number };
  dest: unknown;
}

/** Resolve a PDF link annotation's destination (named or explicit) to a 1-based page number. */
async function resolveDestPage(pdf: PDFDocumentProxy, dest: unknown): Promise<number | null> {
  try {
    let explicitDest = dest;
    if (typeof explicitDest === 'string') {
      explicitDest = await pdf.getDestination(explicitDest);
    }
    if (!Array.isArray(explicitDest) || explicitDest.length === 0) return null;
    const ref = explicitDest[0];
    const pageIndex = typeof ref === 'object' && ref !== null ? await pdf.getPageIndex(ref as any) : Number(ref);
    if (!Number.isFinite(pageIndex)) return null;
    return pageIndex + 1;
  } catch {
    return null;
  }
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function multiplyMatrix(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/**
 * Find the on-page rects covered by embedded images, so the reading-theme
 * filter (esp. invert-based dusk/night) can be masked out over just those
 * regions — inverting a photo/illustration wrecks its colors, while the
 * surrounding text/background should still recolor normally.
 */
async function getImageRects(page: any, viewport: any): Promise<Rect[]> {
  const rects: Rect[] = [];
  try {
    const opList = await page.getOperatorList();
    const { fnArray, argsArray } = opList;
    const imageOps = new Set([
      pdfjsLib.OPS.paintImageXObject,
      pdfjsLib.OPS.paintInlineImageXObject,
      pdfjsLib.OPS.paintImageMaskXObject,
    ]);
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      if (fn === pdfjsLib.OPS.save) {
        stack.push(ctm);
      } else if (fn === pdfjsLib.OPS.restore) {
        ctm = stack.pop() ?? ctm;
      } else if (fn === pdfjsLib.OPS.transform) {
        ctm = multiplyMatrix(ctm, argsArray[i]);
      } else if (imageOps.has(fn)) {
        const corners = [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ].map(([x, y]) => viewport.convertToViewportPoint(ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]));
        const xs = corners.map((p: number[]) => p[0]);
        const ys = corners.map((p: number[]) => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        rects.push({
          x: minX / viewport.width,
          y: minY / viewport.height,
          w: (maxX - minX) / viewport.width,
          h: (maxY - minY) / viewport.height,
        });
      }
    }
  } catch {
    return [];
  }
  return rects;
}

function maskDataUrl(rects: Rect[], width: number, height: number): string {
  // Default CSS mask-mode for an image source is `alpha`, not `luminance` —
  // so the mask must use actual transparency (not black/white color) to hide
  // everything outside the image rects: opaque boxes reveal, and the rest of
  // the SVG canvas is left with no fill at all (fully transparent).
  const boxes = rects
    .map((r) => `<rect x="${r.x * width}" y="${r.y * height}" width="${r.w * width}" height="${r.h * height}" fill="#fff"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${boxes}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export interface PageSlotProps {
  pdf: PDFDocumentProxy | null;
  pageNum: number | null;
  scale: number;
  interactive: boolean;
  textLayerActive?: boolean;
  linksActive?: boolean;
  filter: string;
  onTextLayerReady?: (container: HTMLDivElement, pageNum: number) => void;
  onNavigate?: (page: number) => void;
}

export function PageSlot({
  pdf,
  pageNum,
  scale,
  interactive,
  textLayerActive,
  linksActive,
  filter,
  onTextLayerReady,
  onNavigate,
}: PageSlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [maskUrl, setMaskUrl] = useState<string | null>(null);
  const [links, setLinks] = useState<PdfLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    renderTaskRef.current?.cancel();

    (async () => {
      if (!pdf || !pageNum || !scale || !canvasRef.current) return;
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      // Render at device-pixel resolution (not CSS-pixel) so text/lines stay
      // crisp on retina/high-DPI displays — the canvas backing store is scaled
      // up by devicePixelRatio while its on-screen CSS size stays at `scale`.
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
      const task = page.render({ canvasContext: ctx, viewport, canvas, transform } as any);
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException') return;
        throw err;
      }
      if (cancelled) return;

      // Mask the theme filter out over embedded images: copy the true-color
      // canvas onto an unfiltered overlay, then clip that overlay to just the
      // image rects so only images stay unaffected by the filter.
      if (filter !== 'none') {
        const rects = await getImageRects(page, viewport);
        if (!cancelled && rects.length > 0 && overlayRef.current) {
          const oc = overlayRef.current;
          oc.width = canvas.width;
          oc.height = canvas.height;
          oc.style.width = canvas.style.width;
          oc.style.height = canvas.style.height;
          const octx = oc.getContext('2d');
          octx?.drawImage(canvas, 0, 0);
          setMaskUrl(maskDataUrl(rects, Math.floor(viewport.width), Math.floor(viewport.height)));
        } else if (!cancelled) {
          setMaskUrl(null);
        }
      } else if (!cancelled) {
        setMaskUrl(null);
      }

      if (interactive && textLayerRef.current) {
        textLayerRef.current.innerHTML = '';
        textLayerRef.current.style.width = `${viewport.width}px`;
        textLayerRef.current.style.height = `${viewport.height}px`;
        const textLayer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container: textLayerRef.current,
          viewport,
        });
        await textLayer.render();
        if (!cancelled) onTextLayerReady?.(textLayerRef.current, pageNum);
      }

      // Table-of-contents / cross-reference links: PDF Link annotations with
      // an internal destination (GoTo), positioned as clickable overlays.
      if (linksActive) {
        try {
          const annots = await page.getAnnotations();
          const computed: PdfLink[] = annots
            .filter((a: any) => a.subtype === 'Link' && (a.dest || a.action?.dest))
            .map((a: any) => {
              const [rx1, ry1, rx2, ry2] = a.rect;
              const [x1, y1] = viewport.convertToViewportPoint(rx1, ry1);
              const [x2, y2] = viewport.convertToViewportPoint(rx2, ry2);
              const left = Math.min(x1, x2);
              const top = Math.min(y1, y2);
              return {
                rect: {
                  x: left / viewport.width,
                  y: top / viewport.height,
                  w: Math.abs(x2 - x1) / viewport.width,
                  h: Math.abs(y2 - y1) / viewport.height,
                },
                dest: a.dest ?? a.action?.dest,
              };
            });
          if (!cancelled) setLinks(computed);
        } catch {
          if (!cancelled) setLinks([]);
        }
      } else {
        setLinks([]);
      }
    })().catch((err) => {
      if (err?.name !== 'RenderingCancelledException') console.error('Folio: pdf page render failed', err);
    });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdf, pageNum, scale, interactive, filter, linksActive, onTextLayerReady]);

  const handleLinkClick = async (dest: unknown) => {
    if (!pdf || !onNavigate) return;
    const page = await resolveDestPage(pdf, dest);
    if (page) onNavigate(page);
  };

  if (!pageNum) {
    return <div style={{ width: '100%', height: '100%' }} />;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} style={{ display: 'block', filter }} />
        <canvas
          ref={overlayRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            display: maskUrl ? 'block' : 'none',
            maskImage: maskUrl ?? undefined,
            WebkitMaskImage: maskUrl ?? undefined,
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />
        {interactive && (
          <div
            ref={textLayerRef}
            className="textLayer"
            style={{ position: 'absolute', inset: 0, pointerEvents: textLayerActive ? 'auto' : 'none' }}
          />
        )}
        {linksActive && links.length > 0 && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {links.map((l, i) => (
              <div
                key={i}
                onClick={() => handleLinkClick(l.dest)}
                title="Go to page"
                style={{
                  position: 'absolute',
                  left: `${l.rect.x * 100}%`,
                  top: `${l.rect.y * 100}%`,
                  width: `${l.rect.w * 100}%`,
                  height: `${l.rect.h * 100}%`,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const PdfReader = forwardRef<ReaderHandle, PdfReaderProps>(function PdfReader(
  { data, initialLocation, mode, readingTheme, zoom, highlights, onProgress, onSelection },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageTurnRef = useRef<PageTurnHandle>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  // pageNum = the LEFT page of the current spread; right = pageNum + 1.
  const [pageNum, setPageNum] = useState(Number(initialLocation) || 1);
  const [fitScale, setFitScale] = useState<number | null>(null);

  const theme = READING_THEME_COLORS[readingTheme];
  const naturalWidthRef = useRef(0);
  const naturalHeightRef = useRef(0);
  const computeFit = (el: HTMLElement) =>
    Math.min(((el.offsetWidth / 2) * 0.96) / naturalWidthRef.current, (el.offsetHeight * 0.98) / naturalHeightRef.current);

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
      if (containerRef.current) {
        setFitScale(computeFit(containerRef.current));
      }
    })();
    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Re-fit when the reader's container changes size (e.g. entering/leaving fullscreen).
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!naturalWidthRef.current) return;
        setFitScale(computeFit(el));
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    onProgress({
      location: String(pageNum),
      percent: numPages ? (pageNum - 1) / Math.max(1, numPages - 1) : 0,
      total: numPages,
    });
  }, [pageNum, numPages, onProgress]);

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

  const scale = fitScale ? fitScale * zoom : 0;
  // A turn flips one leaf: its front is the current page, its back is the
  // neighbouring page, and the spread advances by two, like a real book.
  const leftPage = pageNum;
  const rightPage = pageNum + 1 <= numPages ? pageNum + 1 : null;
  const rightBackPage = pageNum + 2 <= numPages ? pageNum + 2 : null;
  const underRightPage = pageNum + 3 <= numPages ? pageNum + 3 : null;
  const leftBackPage = pageNum - 1 >= 1 ? pageNum - 1 : null;
  const underLeftPage = pageNum - 2 >= 1 ? pageNum - 2 : null;
  const canNext = Boolean(rightPage && rightBackPage);
  const canPrev = Boolean(leftBackPage);

  const commitNext = async () => {
    setPageNum((p) => Math.min(Math.max(1, numPages - 1), p + 2));
  };
  const commitPrev = async () => {
    setPageNum((p) => Math.max(1, p - 2));
  };

  const gotoPage = useCallback(
    (n: number) => setPageNum(Math.max(1, Math.min(numPages || n, n))),
    [numPages],
  );

  useImperativeHandle(ref, () => ({
    next: () => pageTurnRef.current?.next(),
    prev: () => pageTurnRef.current?.prev(),
    goTo: (loc: string) => {
      const n = Number(loc);
      if (Number.isFinite(n)) setPageNum(Math.max(1, Math.min(numPages || n, n)));
    },
    goToPercent: (percent: number) => {
      if (!numPages) return;
      const n = Math.round(percent * (numPages - 1)) + 1;
      setPageNum(Math.max(1, Math.min(numPages, n)));
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

  const renderHighlightOverlay = (forPage: number | null) =>
    forPage ? (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {highlights
          .filter((h) => h.page === forPage)
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
    ) : null;

  const slot = (pageNum: number | null, interactive: boolean) => (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <PageSlot
        pdf={pdf}
        pageNum={pdf ? pageNum : null}
        scale={scale}
        interactive={interactive}
        textLayerActive={interactive && mode === 'highlight'}
        linksActive={interactive && mode === 'read'}
        filter={READING_FILTER[readingTheme]}
        onTextLayerReady={interactive ? handleTextLayerReady : undefined}
        onNavigate={interactive ? gotoPage : undefined}
      />
      {renderHighlightOverlay(pageNum)}
    </div>
  );

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <PageTurn
        ref={pageTurnRef}
        dragEnabled={mode !== 'highlight'}
        pageBg={theme.bg}
        canNext={canNext}
        canPrev={canPrev}
        leftContent={slot(leftPage, true)}
        rightContent={slot(rightPage, true)}
        leftBack={slot(leftBackPage, false)}
        rightBack={slot(rightBackPage, false)}
        leftUnderneath={slot(underLeftPage, false)}
        rightUnderneath={slot(underRightPage, false)}
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

export default PdfReader;
