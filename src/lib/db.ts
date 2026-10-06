import { createStore, get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import {
  BaseDirectory,
  exists,
  mkdir,
  readFile,
  writeFile,
  readTextFile,
  writeTextFile,
  remove,
  readDir,
  stat,
} from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import type { BookMeta, ReadingProgress, Bookmark, Highlight, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

/**
 * Folio stores its library in two places depending on how it's running:
 *  - Packaged app (Tauri): real files on disk, under the OS app-data
 *    directory — survives clearing browser/site data entirely, since there
 *    is no browser profile involved.
 *  - Plain browser tab (`npm run dev` opened directly in a browser, used
 *    only for quick iteration during development): falls back to IndexedDB,
 *    since there's no filesystem access to use instead.
 */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const idbStore = isTauri ? null : createStore('folio-db', 'folio-store');

const BOOKS_DIR = 'books';
let dirReady: Promise<void> | null = null;
async function ensureDir(): Promise<void> {
  if (!isTauri) return;
  if (!dirReady) {
    dirReady = (async () => {
      if (!(await exists(BOOKS_DIR, { baseDir: BaseDirectory.AppData }))) {
        await mkdir(BOOKS_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
      }
    })();
  }
  return dirReady;
}

async function readJson<T>(path: string): Promise<T | undefined> {
  if (!isTauri) return idbGet<T>(path, idbStore!);
  await ensureDir();
  if (!(await exists(path, { baseDir: BaseDirectory.AppData }))) return undefined;
  try {
    const text = await readTextFile(path, { baseDir: BaseDirectory.AppData });
    return JSON.parse(text) as T;
  } catch (err) {
    console.error('Folio: failed to read', path, err);
    return undefined;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  if (!isTauri) {
    await idbSet(path, value, idbStore!);
    return;
  }
  await ensureDir();
  await writeTextFile(path, JSON.stringify(value), { baseDir: BaseDirectory.AppData });
}

async function removeIfExists(path: string): Promise<void> {
  if (!isTauri) {
    await idbDel(path, idbStore!);
    return;
  }
  if (await exists(path, { baseDir: BaseDirectory.AppData })) {
    await remove(path, { baseDir: BaseDirectory.AppData });
  }
}

const LIBRARY_KEY = 'library.json';
const SETTINGS_KEY = 'settings.json';

const bookDataPath = (id: string) => `${BOOKS_DIR}/${id}.bin`;
const progressPath = (id: string) => `${BOOKS_DIR}/${id}.progress.json`;
const bookmarksPath = (id: string) => `${BOOKS_DIR}/${id}.bookmarks.json`;
const highlightsPath = (id: string) => `${BOOKS_DIR}/${id}.highlights.json`;

export async function getLibrary(): Promise<BookMeta[]> {
  return (await readJson<BookMeta[]>(LIBRARY_KEY)) ?? [];
}

export async function setLibrary(books: BookMeta[]): Promise<void> {
  await writeJson(LIBRARY_KEY, books);
}

export async function getBookData(id: string): Promise<ArrayBuffer | undefined> {
  if (!isTauri) return idbGet<ArrayBuffer>(`book:${id}:data`, idbStore!);
  await ensureDir();
  const path = bookDataPath(id);
  if (!(await exists(path, { baseDir: BaseDirectory.AppData }))) return undefined;
  const bytes = await readFile(path, { baseDir: BaseDirectory.AppData });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function setBookData(id: string, data: ArrayBuffer): Promise<void> {
  if (!isTauri) {
    await idbSet(`book:${id}:data`, data, idbStore!);
    return;
  }
  await ensureDir();
  await writeFile(bookDataPath(id), new Uint8Array(data), { baseDir: BaseDirectory.AppData });
}

export async function deleteBookData(id: string): Promise<void> {
  if (!isTauri) {
    await Promise.all([
      idbDel(`book:${id}:data`, idbStore!),
      idbDel(`book:${id}:progress`, idbStore!),
      idbDel(`book:${id}:bookmarks`, idbStore!),
      idbDel(`book:${id}:highlights`, idbStore!),
    ]);
    return;
  }
  await Promise.all([
    removeIfExists(bookDataPath(id)),
    removeIfExists(progressPath(id)),
    removeIfExists(bookmarksPath(id)),
    removeIfExists(highlightsPath(id)),
  ]);
}

export async function getProgress(id: string): Promise<ReadingProgress | undefined> {
  return readJson<ReadingProgress>(isTauri ? progressPath(id) : `book:${id}:progress`);
}

export async function setProgress(id: string, progress: ReadingProgress): Promise<void> {
  await writeJson(isTauri ? progressPath(id) : `book:${id}:progress`, progress);
}

export async function getBookmarks(id: string): Promise<Bookmark[]> {
  return (await readJson<Bookmark[]>(isTauri ? bookmarksPath(id) : `book:${id}:bookmarks`)) ?? [];
}

export async function setBookmarks(id: string, bookmarks: Bookmark[]): Promise<void> {
  await writeJson(isTauri ? bookmarksPath(id) : `book:${id}:bookmarks`, bookmarks);
}

export async function getHighlights(id: string): Promise<Highlight[]> {
  return (await readJson<Highlight[]>(isTauri ? highlightsPath(id) : `book:${id}:highlights`)) ?? [];
}

export async function setHighlights(id: string, highlights: Highlight[]): Promise<void> {
  await writeJson(isTauri ? highlightsPath(id) : `book:${id}:highlights`, highlights);
}

export async function getSettings(): Promise<Settings> {
  const stored = await readJson<Settings>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function setSettings(settings: Settings): Promise<void> {
  await writeJson(SETTINGS_KEY, settings);
}

/** Where the library lives on disk — null in the browser-only dev fallback. */
export async function getStorageLocation(): Promise<string | null> {
  if (!isTauri) return null;
  try {
    return await appDataDir();
  } catch {
    return null;
  }
}

export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if (!isTauri) {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    }
    return { usage: 0, quota: 0 };
  }

  await ensureDir();
  let usage = 0;
  try {
    const entries = await readDir(BOOKS_DIR, { baseDir: BaseDirectory.AppData });
    for (const entry of entries) {
      if (!entry.isFile) continue;
      const info = await stat(`${BOOKS_DIR}/${entry.name}`, { baseDir: BaseDirectory.AppData });
      usage += info.size;
    }
  } catch {
    // directory not readable yet — report 0 usage rather than failing
  }

  let quota = 0;
  try {
    const dir = await appDataDir();
    const [, total] = await invoke<[number, number]>('disk_space', { path: dir });
    quota = total;
  } catch {
    // disk_space command unavailable (e.g. dev-in-browser fallback) — quota
    // stays 0 and the UI simply skips the usage percentage.
  }

  return { usage, quota };
}
