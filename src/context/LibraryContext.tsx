import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BookMeta, ReadingProgress } from '../lib/types';
import { getLibrary, setLibrary, deleteBookData, getProgress, setProgress, getBookmarks } from '../lib/db';
import { importBookFile } from '../lib/importBook';

interface LibraryContextValue {
  books: BookMeta[];
  loaded: boolean;
  progressByBook: Record<string, ReadingProgress>;
  bookmarkCounts: Record<string, number>;
  importFiles: (files: FileList | File[]) => Promise<BookMeta[]>;
  removeBook: (id: string) => Promise<void>;
  recordProgress: (id: string, progress: ReadingProgress) => Promise<void>;
  setBookmarkCount: (id: string, count: number) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [progressByBook, setProgressByBook] = useState<Record<string, ReadingProgress>>({});
  const [bookmarkCounts, setBookmarkCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const lib = await getLibrary();
      setBooks(lib);
      const entries = await Promise.all(
        lib.map(async (b) => [b.id, await getProgress(b.id)] as const),
      );
      const map: Record<string, ReadingProgress> = {};
      for (const [id, p] of entries) if (p) map[id] = p;
      setProgressByBook(map);

      const bookmarkEntries = await Promise.all(
        lib.map(async (b) => [b.id, (await getBookmarks(b.id)).length] as const),
      );
      const bmMap: Record<string, number> = {};
      for (const [id, count] of bookmarkEntries) if (count > 0) bmMap[id] = count;
      setBookmarkCounts(bmMap);

      setLoaded(true);
    })();
  }, []);

  const importFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    const imported: BookMeta[] = [];
    for (const file of list) {
      try {
        const meta = await importBookFile(file);
        imported.push(meta);
      } catch (err) {
        console.error('Failed to import', file.name, err);
      }
    }
    if (imported.length) {
      setBooks((prev) => {
        const next = [...imported, ...prev];
        setLibrary(next);
        return next;
      });
    }
    return imported;
  }, []);

  const removeBook = useCallback(async (id: string) => {
    await deleteBookData(id);
    setBooks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      setLibrary(next);
      return next;
    });
    setProgressByBook((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setBookmarkCounts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const recordProgress = useCallback(async (id: string, progress: ReadingProgress) => {
    await setProgress(id, progress);
    setProgressByBook((prev) => {
      const existing = prev[id];
      if (existing && existing.location === progress.location && existing.percent === progress.percent) {
        return prev;
      }
      return { ...prev, [id]: progress };
    });
  }, []);

  // Reader.tsx keeps its own bookmarks list live while a book is open; it
  // reports the count back so the library grid's "bookmarked" badge stays
  // accurate without every card re-reading IndexedDB on every render.
  const setBookmarkCount = useCallback((id: string, count: number) => {
    setBookmarkCounts((prev) => {
      if (count === (prev[id] ?? 0)) return prev;
      const next = { ...prev };
      if (count > 0) next[id] = count;
      else delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__folioImportFiles = importFiles;
    }
  }, [importFiles]);

  const value = useMemo(
    () => ({ books, loaded, progressByBook, bookmarkCounts, importFiles, removeBook, recordProgress, setBookmarkCount }),
    [books, loaded, progressByBook, bookmarkCounts, importFiles, removeBook, recordProgress, setBookmarkCount],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
