import type { ReadingTheme, Typeface, EpubHighlight, PdfHighlight } from '../lib/types';

export interface ReaderProgress {
  location: string;
  percent: number;
  /** Total pages, for PDF books only (epub uses percent-based progress instead). */
  total?: number;
}

export interface EpubSelectionInfo {
  text: string;
  cfiRange: string;
}

export interface PdfSelectionInfo {
  text: string;
  page: number;
  rects: { x: number; y: number; w: number; h: number }[];
}

export interface BaseReaderProps {
  data: ArrayBuffer;
  initialLocation?: string;
  mode: 'read' | 'highlight';
  readingTheme: ReadingTheme;
  onProgress: (p: ReaderProgress) => void;
}

export interface EpubReaderProps extends BaseReaderProps {
  fontSize: number;
  typeface: Typeface;
  highlights: EpubHighlight[];
  onSelection: (info: EpubSelectionInfo) => void;
}

export interface PdfReaderProps extends BaseReaderProps {
  zoom: number;
  highlights: PdfHighlight[];
  onSelection: (info: PdfSelectionInfo) => void;
}

export interface SearchResult {
  id: string;
  /** Passed straight to goTo() to jump there. */
  location: string;
  excerpt: string;
  label?: string;
}

export interface ReaderHandle {
  next: () => void;
  prev: () => void;
  goTo: (location: string) => void;
  /** Jump to a fraction (0..1) of the book — what the progress bar seeks by. */
  goToPercent: (percent: number) => void;
  /** Full-text search across the whole book, not just the visible spread. */
  search: (query: string) => Promise<SearchResult[]>;
}
