import ePub from 'epubjs';
import * as pdfjsLib from 'pdfjs-dist';
import type { BookMeta, BookType } from './types';
import { setBookData } from './db';

function idFromName(name: string): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${name
    .replace(/[^a-z0-9]+/gi, '-')
    .slice(0, 40)}`;
}

function detectType(file: File): BookType | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.epub') || file.type === 'application/epub+zip') return 'epub';
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  return null;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function renderPdfCoverToDataUrl(data: ArrayBuffer): Promise<string | null> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const targetWidth = 240;
    const scale = targetWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas } as any).promise;
    const url = canvas.toDataURL('image/png');
    await loadingTask.destroy();
    return url;
  } catch {
    return null;
  }
}

async function extractEpubMeta(
  data: ArrayBuffer,
  file: File,
): Promise<{ title: string; author: string; coverDataUrl: string | null }> {
  const book = ePub(data.slice(0));
  try {
    await book.ready;
    const metadata = await book.loaded.metadata;
    let coverDataUrl: string | null = null;
    try {
      const coverUrl = await book.coverUrl();
      if (coverUrl) {
        const res = await fetch(coverUrl);
        const blob = await res.blob();
        coverDataUrl = await blobToDataUrl(blob);
      }
    } catch {
      coverDataUrl = null;
    }
    return {
      title: metadata.title || file.name.replace(/\.epub$/i, ''),
      author: metadata.creator || 'Unknown author',
      coverDataUrl,
    };
  } finally {
    book.destroy();
  }
}

async function extractPdfMeta(
  data: ArrayBuffer,
  file: File,
): Promise<{ title: string; author: string; coverDataUrl: string | null }> {
  const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
  const pdf = await loadingTask.promise;
  let title = file.name.replace(/\.pdf$/i, '');
  let author = 'Unknown author';
  try {
    const meta = await pdf.getMetadata();
    const info = meta.info as any;
    if (info?.Title) title = info.Title;
    if (info?.Author) author = info.Author;
  } catch {
    // ignore, keep filename fallback
  }
  await loadingTask.destroy();
  const coverDataUrl = await renderPdfCoverToDataUrl(data);
  return { title, author, coverDataUrl };
}

export async function importBookFile(file: File): Promise<BookMeta> {
  const type = detectType(file);
  if (!type) {
    throw new Error(`Unsupported file type: ${file.name}`);
  }
  const data = await file.arrayBuffer();
  const meta =
    type === 'epub' ? await extractEpubMeta(data, file) : await extractPdfMeta(data, file);

  const bookMeta: BookMeta = {
    id: idFromName(file.name),
    type,
    title: meta.title,
    author: meta.author,
    coverDataUrl: meta.coverDataUrl,
    addedAt: Date.now(),
    fileName: file.name,
    fileSize: file.size,
  };

  await setBookData(bookMeta.id, data);
  return bookMeta;
}
