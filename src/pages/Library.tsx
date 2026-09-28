import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import BookCard from '../components/BookCard';
import ContinueReadingCard from '../components/ContinueReadingCard';
import { SearchIcon, PlusIcon } from '../components/Icons';
import { useLibrary } from '../context/LibraryContext';
import { staggerContainer, staggerItem } from '../motion/springs';
import type { BookType } from '../lib/types';

type SortKey = 'recent' | 'title' | 'author';
type TypeFilter = 'all' | BookType;

export default function Library() {
  const { books, loaded, progressByBook, bookmarkCounts, importFiles, removeBook } = useLibrary();
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = books;
    if (typeFilter !== 'all') list = list.filter((b) => b.type === typeFilter);
    if (q) list = list.filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    const sorted = [...list];
    if (sortKey === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortKey === 'author') sorted.sort((a, b) => a.author.localeCompare(b.author));
    else sorted.sort((a, b) => b.addedAt - a.addedAt);
    return sorted;
  }, [books, query, typeFilter, sortKey]);

  const continueReading = useMemo(
    () =>
      books
        .filter((b) => progressByBook[b.id] && progressByBook[b.id].percent > 0 && progressByBook[b.id].percent < 0.999)
        .sort((a, b) => (progressByBook[b.id]?.updatedAt ?? 0) - (progressByBook[a.id]?.updatedAt ?? 0))
        .slice(0, 3),
    [books, progressByBook],
  );

  const onImportClick = () => fileInputRef.current?.click();

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImporting(true);
    try {
      await importFiles(files);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-alt)',
    color: 'var(--text)',
    border: '1px solid var(--divider)',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12.5,
    fontFamily: 'inherit',
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 36px 18px' }}>
          <div
            style={{
              flex: '1 1 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--bg-alt)',
              borderRadius: 10,
              padding: '10px 14px',
              maxWidth: 560,
              minWidth: 160,
            }}
          >
            <SearchIcon size={16} color="var(--text-dim)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your library…"
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 14,
                color: 'var(--text)',
                width: '100%',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub,.pdf,application/epub+zip,application/pdf"
            multiple
            onChange={onFilesSelected}
            style={{ display: 'none' }}
          />
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={onImportClick}
            disabled={importing}
            style={{
              marginLeft: 'auto',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--accent)',
              color: 'var(--btn-fg)',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 600,
              opacity: importing ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            <PlusIcon size={16} />
            {importing ? 'Importing…' : 'Import book'}
          </motion.button>
        </div>

        <div className="scroll-y" style={{ flex: 1, padding: '6px 36px 32px', display: 'flex', flexDirection: 'column', gap: 30 }}>
          {continueReading.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>
                Continue Reading
              </div>
              <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'flex', gap: 20 }}>
                {continueReading.map((b) => (
                  <ContinueReadingCard key={b.id} book={b} progress={progressByBook[b.id]} />
                ))}
              </motion.div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  All Books
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
                  {filtered.length} of {books.length} book{books.length === 1 ? '' : 's'}
                </div>
              </div>

              {books.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    aria-label="Filter by format"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                    style={selectStyle}
                  >
                    <option value="all">All formats</option>
                    <option value="epub">EPUB</option>
                    <option value="pdf">PDF</option>
                  </select>
                  <select
                    aria-label="Sort books"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    style={selectStyle}
                  >
                    <option value="recent">Recently added</option>
                    <option value="title">Title A–Z</option>
                    <option value="author">Author A–Z</option>
                  </select>
                </div>
              )}
            </div>

            {loaded && books.length === 0 && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--text)' }}>
                  Your library is empty
                </div>
                <div style={{ fontSize: 13, maxWidth: 320 }}>
                  Import an EPUB or PDF to get started — it'll be parsed, covered, and ready to read right away.
                </div>
              </div>
            )}

            {filtered.length === 0 && books.length > 0 && (
              <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '20px 0' }}>
                No books match{query.trim() ? ` "${query}"` : ' this filter'}.
              </div>
            )}

            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                columnGap: 22,
                rowGap: 24,
                alignItems: 'start',
              }}
            >
              {filtered.map((b) => (
                <BookCard key={b.id} book={b} bookmarked={Boolean(bookmarkCounts[b.id])} onDelete={(bk) => removeBook(bk.id)} />
              ))}
              {loaded && books.length > 0 && !query.trim() && typeFilter === 'all' && (
                <motion.button
                  variants={staggerItem}
                  whileHover={{ y: -6 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onImportClick}
                  aria-label="Import a book"
                  style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
                >
                  <div
                    style={{
                      aspectRatio: '2 / 3',
                      width: '100%',
                      borderRadius: 5,
                      border: '1.5px dashed var(--divider)',
                      background: 'transparent',
                      color: 'var(--text-dim)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      fontSize: 12.5,
                    }}
                  >
                    <PlusIcon size={22} />
                    Add book
                  </div>
                  {/* Invisible spacers matching BookCard's title+author row heights, so this tile lines up exactly with the book covers beside it. */}
                  <div style={{ height: 31 }} aria-hidden />
                  <div style={{ height: 14 }} aria-hidden />
                </motion.button>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
