import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import EpubReader from '../reader/EpubReader';
import PdfReader from '../reader/PdfReader';
import EpubScrollReader from '../reader/EpubScrollReader';
import PdfScrollReader from '../reader/PdfScrollReader';
import type { ReaderHandle } from '../reader/readerTypes';
import ModeSwitch from '../components/ModeSwitch';
import AppearancePopover from '../components/AppearancePopover';
import BookmarksPanel from '../components/BookmarksPanel';
import HighlightPicker from '../components/HighlightPicker';
import ProgressBar from '../components/ProgressBar';
import SearchPanel from '../components/SearchPanel';
import Toast, { type ToastItem } from '../components/Toast';
import type { SearchResult } from '../reader/readerTypes';
import {
  BackIcon,
  BookmarkIcon,
  HighlightIcon,
  AppearanceIcon,
  SearchIcon,
  LibraryIcon,
  ChevronLeft,
  ChevronRight,
  ExpandIcon,
  ShrinkIcon,
  BookOpenIcon,
  ScrollIcon,
} from '../components/Icons';
import { useLibrary } from '../context/LibraryContext';
import { useSettings } from '../context/SettingsContext';
import { getBookData, getBookmarks, setBookmarks, getHighlights, setHighlights } from '../lib/db';
import { makeId } from '../lib/id';
import { useFullscreen } from '../lib/useFullscreen';
import type { Bookmark, Highlight, EpubHighlight, PdfHighlight, HighlightColor } from '../lib/types';

export default function Reader() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { books, loaded, recordProgress, progressByBook, setBookmarkCount } = useLibrary();
  const { settings, update: updateSettings } = useSettings();

  const book = books.find((b) => b.id === bookId) ?? null;
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [mode, setMode] = useState<'read' | 'highlight'>('read');
  const [viewMode, setViewMode] = useState<'paged' | 'scroll'>('paged');
  const [panelOpen, setPanelOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [location, setLocation] = useState('');
  const [percent, setPercent] = useState(0);
  const [totalPages, setTotalPages] = useState<number | undefined>(undefined);
  const [bookmarks, setBookmarksState] = useState<Bookmark[]>([]);
  const [highlights, setHighlightsState] = useState<Highlight[]>([]);
  const [pendingSelection, setPendingSelection] = useState<
    | { kind: 'epub'; text: string; cfiRange: string }
    | { kind: 'pdf'; text: string; page: number; rects: { x: number; y: number; w: number; h: number }[] }
    | null
  >(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const readerRef = useRef<ReaderHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(rootRef);
  const preFullscreenZoom = useRef(1);
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isFullscreen) {
      setChromeVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      return;
    }
    const EDGE = 90;
    const onMove = (e: MouseEvent) => {
      const nearEdge = e.clientY < EDGE || e.clientY > window.innerHeight - EDGE;
      if (nearEdge) {
        if (hideTimer.current) {
          clearTimeout(hideTimer.current);
          hideTimer.current = null;
        }
        setChromeVisible(true);
      } else if (!hideTimer.current) {
        hideTimer.current = setTimeout(() => {
          setChromeVisible(false);
          hideTimer.current = null;
        }, 900);
      }
    };
    window.addEventListener('mousemove', onMove);
    const initialHide = setTimeout(() => setChromeVisible(false), 1400);
    return () => {
      window.removeEventListener('mousemove', onMove);
      clearTimeout(initialHide);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (isFullscreen) {
      setZoom((z) => {
        preFullscreenZoom.current = z;
        return 1;
      });
    } else {
      setZoom(preFullscreenZoom.current);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      const [buf, bm, hl] = await Promise.all([getBookData(bookId), getBookmarks(bookId), getHighlights(bookId)]);
      if (cancelled) return;
      setData(buf ?? null);
      setBookmarksState(bm);
      setHighlightsState(hl);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (bookId) setBookmarkCount(bookId, bookmarks.length);
  }, [bookId, bookmarks.length, setBookmarkCount]);

  const pushToast = (text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  };

  const onProgress = useCallback(
    ({ location: loc, percent: pct, total }: { location: string; percent: number; total?: number }) => {
      setLocation(loc);
      setPercent(pct);
      if (total !== undefined) setTotalPages(total);
      if (bookId) recordProgress(bookId, { location: loc, percent: pct, updatedAt: Date.now() });
    },
    [bookId, recordProgress],
  );

  const onEpubSelection = useCallback(
    (info: { text: string; cfiRange: string }) => {
      setPendingSelection({ kind: 'epub', text: info.text, cfiRange: info.cfiRange });
    },
    [],
  );

  const onPdfSelection = useCallback(
    (info: { text: string; page: number; rects: { x: number; y: number; w: number; h: number }[] }) => {
      setPendingSelection({ kind: 'pdf', text: info.text, page: info.page, rects: info.rects });
    },
    [],
  );

  const commitHighlight = async (color: HighlightColor) => {
    if (!bookId || !pendingSelection) return;
    let entry: Highlight;
    if (pendingSelection.kind === 'epub') {
      entry = {
        id: makeId(),
        kind: 'epub',
        cfiRange: pendingSelection.cfiRange,
        text: pendingSelection.text,
        color,
        addedAt: Date.now(),
      } satisfies EpubHighlight;
    } else {
      entry = {
        id: makeId(),
        kind: 'pdf',
        page: pendingSelection.page,
        rects: pendingSelection.rects,
        text: pendingSelection.text,
        color,
        addedAt: Date.now(),
      } satisfies PdfHighlight;
    }
    const next = [...highlights, entry];
    setHighlightsState(next);
    await setHighlights(bookId, next);
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
    pushToast('Highlight saved');
  };

  const removeHighlight = async (id: string) => {
    if (!bookId) return;
    const next = highlights.filter((h) => h.id !== id);
    setHighlightsState(next);
    await setHighlights(bookId, next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode === 'highlight') return;
      if (e.key === 'ArrowRight' || e.key === ' ') readerRef.current?.next();
      if (e.key === 'ArrowLeft') readerRef.current?.prev();
      // In fullscreen, Escape's job is to exit fullscreen (the browser already
      // does this natively) — don't also navigate away in the same keystroke.
      if (e.key === 'Escape' && !isFullscreen) navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, navigate, isFullscreen]);

  const currentBookmark = bookmarks.find((b) => b.location === location);

  const toggleBookmark = async () => {
    if (!bookId || !location) return;
    let next: Bookmark[];
    if (currentBookmark) {
      next = bookmarks.filter((b) => b.id !== currentBookmark.id);
    } else {
      const label = book?.type === 'pdf' ? `Page ${location}` : `${Math.round(percent * 100)}% through the book`;
      next = [...bookmarks, { id: makeId(), location, label, addedAt: Date.now() }];
      pushToast('Bookmark added');
    }
    setBookmarksState(next);
    await setBookmarks(bookId, next);
  };

  const removeBookmark = async (id: string) => {
    if (!bookId) return;
    const next = bookmarks.filter((b) => b.id !== id);
    setBookmarksState(next);
    await setBookmarks(bookId, next);
  };

  if (!loaded || !book || !data) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
        Loading book…
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-alt)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <motion.div
        animate={{ opacity: isFullscreen && !chromeVisible ? 0 : 1, y: isFullscreen && !chromeVisible ? -16 : 0 }}
        transition={{ duration: 0.22 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '18px 30px',
          position: isFullscreen ? 'absolute' : 'relative',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          background: isFullscreen ? 'linear-gradient(to bottom, rgba(0,0,0,.35), transparent)' : undefined,
          pointerEvents: isFullscreen && !chromeVisible ? 'none' : 'auto',
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: 13.5 }}>
          <BackIcon size={16} />
          Library
        </Link>
        <div style={{ width: 1, height: 16, background: 'var(--divider)' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 600 }}>{book.title}</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {book.type === 'pdf'
              ? `Page ${location || 1}${totalPages ? ` of ${totalPages}` : ''}`
              : `${Math.round(percent * 100)}% through`}
          </span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className={`icon-btn${searchOpen ? ' active' : ''}`}
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search this book"
          >
            <SearchIcon size={18} />
          </button>
          <ModeSwitch mode={mode} onChange={setMode} />
          <button
            className="icon-btn"
            onClick={() => setViewMode((v) => (v === 'paged' ? 'scroll' : 'paged'))}
            aria-label={viewMode === 'paged' ? 'Switch to continuous scroll' : 'Switch to page-turn view'}
            title={viewMode === 'paged' ? 'Continuous scroll' : 'Page-turn view'}
          >
            {viewMode === 'paged' ? <ScrollIcon size={18} /> : <BookOpenIcon size={18} />}
          </button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            className={`icon-btn${currentBookmark ? ' active' : ''}`}
            onClick={toggleBookmark}
            aria-label="Toggle bookmark"
          >
            <BookmarkIcon size={18} filled={Boolean(currentBookmark)} color={currentBookmark ? 'var(--accent)' : 'currentColor'} />
          </motion.button>
          <button
            className={`icon-btn${panelOpen ? ' active' : ''}`}
            onClick={() => setPanelOpen((v) => !v)}
            aria-label="Bookmarks and highlights"
          >
            <LibraryIcon size={18} />
          </button>
          <button
            className={`icon-btn${appearanceOpen ? ' active' : ''}`}
            onClick={() => setAppearanceOpen((v) => !v)}
            aria-label="Appearance"
          >
            <AppearanceIcon size={18} />
          </button>
          <button
            className="icon-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <ShrinkIcon size={18} /> : <ExpandIcon size={18} />}
          </button>
        </div>
      </motion.div>

      {mode === 'highlight' && (
        <div
          style={{
            margin: '0 30px',
            padding: '9px 16px',
            borderRadius: 10,
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent-soft-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <HighlightIcon size={15} color="var(--accent)" />
          <span style={{ fontSize: 12.5, color: 'var(--accent-strong)' }}>
            Highlight mode — select any text to mark it up. Click <strong>Read</strong> above to go back.
          </span>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: isFullscreen ? 12 : 20 }}>
          {mode === 'read' && viewMode === 'paged' && (
            <>
              <motion.button
                whileHover={{ scale: 1.08, x: -2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => readerRef.current?.prev()}
                className="icon-btn"
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 15 }}
                aria-label="Previous page"
              >
                <ChevronLeft size={22} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.08, x: 2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => readerRef.current?.next()}
                className="icon-btn"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 15 }}
                aria-label="Next page"
              >
                <ChevronRight size={22} />
              </motion.button>
            </>
          )}
          <div
            style={{
              width: isFullscreen ? '99%' : 'min(1500px, 96%)',
              height: '100%',
              position: 'relative',
              transition: 'width 0.3s ease, height 0.3s ease',
            }}
          >
            {book.type === 'epub' ? (
              viewMode === 'scroll' ? (
                <EpubScrollReader
                  ref={readerRef}
                  data={data}
                  initialLocation={progressByBook[book.id]?.location}
                  mode={mode}
                  readingTheme={settings.readingTheme}
                  fontSize={settings.fontSize}
                  typeface={settings.typeface}
                  highlights={highlights.filter((h): h is EpubHighlight => h.kind === 'epub')}
                  onProgress={onProgress}
                  onSelection={onEpubSelection}
                />
              ) : (
                <EpubReader
                  ref={readerRef}
                  data={data}
                  initialLocation={progressByBook[book.id]?.location}
                  mode={mode}
                  readingTheme={settings.readingTheme}
                  fontSize={settings.fontSize}
                  typeface={settings.typeface}
                  highlights={highlights.filter((h): h is EpubHighlight => h.kind === 'epub')}
                  onProgress={onProgress}
                  onSelection={onEpubSelection}
                />
              )
            ) : viewMode === 'scroll' ? (
              <PdfScrollReader
                ref={readerRef}
                data={data}
                initialLocation={progressByBook[book.id]?.location}
                mode={mode}
                readingTheme={settings.readingTheme}
                zoom={zoom}
                highlights={highlights.filter((h): h is PdfHighlight => h.kind === 'pdf')}
                onProgress={onProgress}
                onSelection={onPdfSelection}
              />
            ) : (
              <PdfReader
                ref={readerRef}
                data={data}
                initialLocation={progressByBook[book.id]?.location}
                mode={mode}
                readingTheme={settings.readingTheme}
                zoom={zoom}
                highlights={highlights.filter((h): h is PdfHighlight => h.kind === 'pdf')}
                onProgress={onProgress}
                onSelection={onPdfSelection}
              />
            )}
          </div>

          <AppearancePopover
            open={appearanceOpen}
            bookType={book.type}
            readingTheme={settings.readingTheme}
            onReadingThemeChange={(t) => updateSettings({ readingTheme: t })}
            fontSize={settings.fontSize}
            onFontSizeChange={(n) => updateSettings({ fontSize: n })}
            typeface={settings.typeface}
            onTypefaceChange={(t) => updateSettings({ typeface: t })}
            zoom={zoom}
            onZoomChange={setZoom}
          />

          <SearchPanel
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            onSearch={(q) => readerRef.current?.search(q) ?? Promise.resolve([])}
            onJump={(r: SearchResult) => {
              readerRef.current?.goTo(r.location);
              setSearchOpen(false);
            }}
          />

          <HighlightPicker
            open={Boolean(pendingSelection)}
            onPick={commitHighlight}
            onCancel={() => {
              setPendingSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
          />
        </div>

        <BookmarksPanel
          open={panelOpen}
          bookmarks={bookmarks}
          highlights={highlights}
          onJumpBookmark={(b) => {
            readerRef.current?.goTo(b.location);
            setPanelOpen(false);
          }}
          onJumpHighlight={(h) => {
            const loc = h.kind === 'epub' ? h.cfiRange : String(h.page);
            readerRef.current?.goTo(loc);
            setPanelOpen(false);
          }}
          onRemoveBookmark={removeBookmark}
          onRemoveHighlight={removeHighlight}
        />
      </div>

      <motion.div
        animate={{ opacity: isFullscreen && !chromeVisible ? 0 : 1, y: isFullscreen && !chromeVisible ? 16 : 0 }}
        transition={{ duration: 0.22 }}
        style={{
          position: isFullscreen ? 'absolute' : 'relative',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          background: isFullscreen ? 'linear-gradient(to top, rgba(0,0,0,.35), transparent)' : undefined,
          pointerEvents: isFullscreen && !chromeVisible ? 'none' : 'auto',
        }}
      >
        <ProgressBar
          percent={percent}
          label={
            book.type === 'pdf'
              ? `Page ${location || '1'}${totalPages ? ` of ${totalPages}` : ''}`
              : `${Math.round(percent * 100)}% read`
          }
          onSeek={(p) => readerRef.current?.goToPercent(p)}
        />
      </motion.div>

      <Toast toasts={toasts} />
    </div>
  );
}
