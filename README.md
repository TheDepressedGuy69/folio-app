# Folio

Folio is a native desktop ebook reader for EPUB and PDF files (macOS/Windows/Linux via [Tauri](https://tauri.app)) — not a website, not a browser tab. It focuses on a polished, physical page-turn reading experience, real highlighting and bookmarking, full-text search, and a proper light/dark app theme layered on top of separate reading themes (Paper, Sepia, Dusk, Night).

Everything runs locally. Books you import are parsed on-device and stored as real files on disk, in the OS's standard per-app data directory (`~/Library/Application Support/com.folio.app` on macOS) — nothing is uploaded anywhere, and nothing lives in browser storage, so clearing browser/site data has no effect on your library.

## Features

- **EPUB and PDF support** — drop in either format and read it with the same UI.
- **Two-page spread with a real page-turn animation** — drag-to-flip physics (press, pull, and release) with a visible front and back to each page, not a slide or a cut.
- **Fullscreen reading** — the page-turn animation and pagination stay correct at any window size, including fullscreen.
- **Reading themes** — Paper, Sepia, Dusk, and Night. EPUB gets true text recoloring; PDF approximates it with a color filter that's smart enough to skip inverting embedded images/photos, so illustrations don't get wrecked by dark mode.
- **App theme** — independent light/dark/system theme for the app chrome itself (library, toolbars, panels), separate from the reading theme.
- **Highlighting** — select text in either format, pick a color, and it persists across sessions. EPUB highlights use native CFI ranges; PDF highlights are captured as normalized overlay rects that survive zoom changes.
- **Bookmarks** — one-click bookmark toggle, with a panel listing all bookmarks and highlights for the current book, each one click-to-jump.
- **Full-text search** — search the whole book, not just the visible page. EPUB search walks every chapter via epub.js; PDF search scans extracted text per page. Results show a highlighted excerpt and jump straight to the match.
- **Clickable PDF internal links** — table-of-contents entries and cross-references inside a PDF (real `Link` annotations) are clickable and navigate to the right page.
- **Progress tracking** — a seekable progress bar (click or drag to jump anywhere in the book), reading position saved automatically on every page turn and restored on reopen.
- **Library management** — import multiple files at once, search/sort/filter your library by title, author, or format, and remove books (with an inline confirm, not a browser `confirm()` dialog).
- **Reading customization** — adjustable font size and typeface (serif/sans) for EPUB, adjustable zoom for PDF.
- **Storage usage** — see how much real disk space your library is using, and where it's stored.

## Use cases

- Reading EPUBs or PDFs you already own, entirely locally, without installing a desktop reader app or sending files to a third-party service.
- Reading long-form PDFs (papers, manuscripts, scanned books) with a proper two-page book layout instead of a single scrolling column.
- Studying or referencing a book with highlights and bookmarks that persist between sessions.
- Quickly finding a passage or reference in a large book via full-text search instead of scrubbing through pages manually.
- Reading comfortably at night or in bright light using the reading themes, independent of your OS/browser theme.

## Tech stack

- **[Tauri 2](https://tauri.app)** (Rust) — packages the app as a native window with a real OS webview, and is the only thing with filesystem access; the UI talks to it through a small set of typed commands/plugins, never raw Node/browser APIs.
- **React 19 + TypeScript + Vite** for the UI.
- **[epub.js](https://github.com/futurepress/epub.js)** for EPUB rendering, pagination, and CFI-based navigation/highlighting
- **[pdf.js](https://github.com/mozilla/pdf.js)** (`pdfjs-dist`) for PDF rendering, text extraction, and link annotations
- **Framer Motion** for the page-turn physics and all UI animation
- **`@tauri-apps/plugin-fs`** for on-disk persistence (library metadata, book files, progress, bookmarks, highlights, settings) under the OS app-data directory
- **React Router** for navigation between Library / Reader / Settings

No backend, no server, no accounts, no browser storage — it's a self-contained native app.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later and npm
- [Rust](https://www.rust-lang.org/tools/install) (stable) — needed to build the native shell
- On macOS: Xcode Command Line Tools (`xcode-select --install`)

### Run the app

```bash
git clone https://github.com/TheDepressedGuy69/folio-app.git
cd folio-app
npm install
npm run app:dev
```

This compiles the Rust shell (slow the first time, fast after) and opens Folio as a real desktop window pointed at the Vite dev server, with hot reload for the UI.

### Build an installable app

```bash
npm run app:build
```

Produces a standalone `.app` (and a `.dmg` on macOS) under `src-tauri/target/release/bundle/`, ready to drag into Applications — no dev server or Node required to run it afterward.

### Other scripts

```bash
npm run dev        # Vite dev server only, opened in a plain browser tab — for quick UI iteration; falls back to IndexedDB storage in this mode
npm run build       # type-check and build the web assets to dist/ (used internally by app:build)
npm run lint        # run oxlint
```

### Test fixtures

`public/fixtures/` contains a small sample EPUB and PDF (generated by `scripts/makeFixtures.mjs`) you can import to try the app without your own files.

## Project structure

```
src/
  pages/        Library, Reader, Settings — the three top-level screens
  reader/       EpubReader and PdfReader — format-specific rendering engines
  motion/       PageTurn (the drag-physics page-flip component) and shared animation presets
  components/   Reusable UI: BookCard, BookmarksPanel, SearchPanel, AppearancePopover, etc.
  context/      LibraryContext and SettingsContext (React context + on-disk-backed state)
  lib/          Storage access (db.ts), book import/parsing, shared types
src-tauri/      The Rust native shell: window config, filesystem permissions, and the
                one custom command (disk space) the UI needs beyond the fs plugin
```

## Notes / known limitations

- PDF reading theme (Dusk/Night) is a color filter approximation, not true recoloring — PDF pages are rasterized, not real text like EPUB.
- Font size and typeface controls apply to EPUB only; PDF uses zoom instead, since its layout is fixed.
- Your library lives in the OS app-data directory (shown in Settings → Storage), as real files Folio owns — not in any browser's storage, so it isn't affected by clearing browser/site data.
