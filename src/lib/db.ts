import { createStore, get, set, del } from 'idb-keyval';
import type { BookMeta, ReadingProgress, Bookmark, Highlight, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

const store = createStore('folio-db', 'folio-store');

const LIBRARY_KEY = 'library';
const SETTINGS_KEY = 'settings';

export async function getLibrary(): Promise<BookMeta[]> {
  return (await get<BookMeta[]>(LIBRARY_KEY, store)) ?? [];
}

export async function setLibrary(books: BookMeta[]): Promise<void> {
  await set(LIBRARY_KEY, books, store);
}

export async function getBookData(id: string): Promise<ArrayBuffer | undefined> {
  return get<ArrayBuffer>(`book:${id}:data`, store);
}

export async function setBookData(id: string, data: ArrayBuffer): Promise<void> {
  await set(`book:${id}:data`, data, store);
}

export async function deleteBookData(id: string): Promise<void> {
  await Promise.all([
    del(`book:${id}:data`, store),
    del(`book:${id}:progress`, store),
    del(`book:${id}:bookmarks`, store),
    del(`book:${id}:highlights`, store),
  ]);
}

export async function getProgress(id: string): Promise<ReadingProgress | undefined> {
  return get<ReadingProgress>(`book:${id}:progress`, store);
}

export async function setProgress(id: string, progress: ReadingProgress): Promise<void> {
  await set(`book:${id}:progress`, progress, store);
}

export async function getBookmarks(id: string): Promise<Bookmark[]> {
  return (await get<Bookmark[]>(`book:${id}:bookmarks`, store)) ?? [];
}

export async function setBookmarks(id: string, bookmarks: Bookmark[]): Promise<void> {
  await set(`book:${id}:bookmarks`, bookmarks, store);
}

export async function getHighlights(id: string): Promise<Highlight[]> {
  return (await get<Highlight[]>(`book:${id}:highlights`, store)) ?? [];
}

export async function setHighlights(id: string, highlights: Highlight[]): Promise<void> {
  await set(`book:${id}:highlights`, highlights, store);
}

export async function getSettings(): Promise<Settings> {
  const stored = await get<Settings>(SETTINGS_KEY, store);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function setSettings(settings: Settings): Promise<void> {
  await set(SETTINGS_KEY, settings, store);
}

export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  }
  return { usage: 0, quota: 0 };
}
