export type BookType = 'epub' | 'pdf';

export interface BookMeta {
  id: string;
  type: BookType;
  title: string;
  author: string;
  coverDataUrl: string | null;
  addedAt: number;
  fileName: string;
  fileSize: number;
}

export interface ReadingProgress {
  location: string; // epub CFI, or pdf page number as string
  percent: number; // 0..1
  updatedAt: number;
}

export type HighlightColor = 'yellow' | 'green' | 'red' | 'blue';

export interface EpubHighlight {
  id: string;
  kind: 'epub';
  cfiRange: string;
  text: string;
  color: HighlightColor;
  addedAt: number;
}

export interface PdfHighlightRect {
  x: number; // 0..1, fraction of page width
  y: number; // 0..1, fraction of page height
  w: number; // 0..1
  h: number; // 0..1
}

export interface PdfHighlight {
  id: string;
  kind: 'pdf';
  page: number;
  rects: PdfHighlightRect[];
  text: string;
  color: HighlightColor;
  addedAt: number;
}

export type Highlight = EpubHighlight | PdfHighlight;

export interface Bookmark {
  id: string;
  location: string; // epub CFI, or pdf page number as string
  label: string;
  addedAt: number;
}

export type AppTheme = 'light' | 'dark' | 'system';
export type ReadingTheme = 'paper' | 'sepia' | 'dusk' | 'night';
export type Typeface = 'serif' | 'sans';

export interface Settings {
  appTheme: AppTheme;
  readingTheme: ReadingTheme;
  fontSize: number; // percent, 100 = default
  typeface: Typeface;
}

export const DEFAULT_SETTINGS: Settings = {
  appTheme: 'dark',
  readingTheme: 'paper',
  fontSize: 100,
  typeface: 'serif',
};

export const READING_THEME_COLORS: Record<ReadingTheme, { bg: string; fg: string }> = {
  paper: { bg: '#f7f1e3', fg: '#211d18' },
  sepia: { bg: '#efe3c6', fg: '#3a2f1f' },
  dusk: { bg: '#2b2620', fg: '#e8ddc4' },
  night: { bg: '#0a0806', fg: '#c9bfa9' },
};

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: '#f3d98c',
  green: '#a9cb9f',
  red: '#f0afaf',
  blue: '#a9c3e8',
};
