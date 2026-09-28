import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT_DIR = new URL('../public/fixtures/', import.meta.url);
mkdirSync(OUT_DIR, { recursive: true });

// ---------- EPUB ----------
async function makeEpub() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );

  const chapters = [
    { id: 'ch1', title: 'The Estuary', },
    { id: 'ch2', title: 'Fieldnotes' },
    { id: 'ch3', title: 'Salt Almanac' },
  ];

  const paragraph = (n) =>
    Array.from({ length: 14 }, (_, i) => `<p>Paragraph ${n}.${i + 1} — the estuary kept its own time, indifferent to the tide charts we carried, and every gull on the last post of the pier seemed to know it before we did. This is filler sentence ${i} to give the reader real pages to turn.</p>`).join('\n');

  chapters.forEach((c, idx) => {
    zip.file(
      `OEBPS/${c.id}.xhtml`,
      `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${c.title}</title></head>
<body>
<h1>${idx + 1}. ${c.title}</h1>
${paragraph(idx + 1)}
</body>
</html>`,
    );
  });

  const manifestItems = chapters
    .map((c) => `<item id="${c.id}" href="${c.id}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n');
  const spineItems = chapters.map((c) => `<itemref idref="${c.id}"/>`).join('\n');

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:folio-test-epub-001</dc:identifier>
    <dc:title>The Long Tide</dc:title>
    <dc:creator>Mira Ashworth</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`,
  );

  const navPoints = chapters
    .map(
      (c, i) =>
        `<navPoint id="np-${c.id}" playOrder="${i + 1}"><navLabel><text>${c.title}</text></navLabel><content src="${c.id}.xhtml"/></navPoint>`,
    )
    .join('\n');

  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head></head>
  <docTitle><text>The Long Tide</text></docTitle>
  <navMap>${navPoints}</navMap>
</ncx>`,
  );

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  writeFileSync(new URL('sample.epub', OUT_DIR), buf);
  console.log('wrote sample.epub', buf.length, 'bytes');
}

// ---------- PDF ----------
async function makePdf() {
  const doc = await PDFDocument.create();
  doc.setTitle('Fieldnotes on Silence');
  doc.setAuthor('R. Okafor');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 1; i <= 6; i++) {
    const page = doc.addPage([420, 560]);
    page.drawText(`Chapter ${i}`, { x: 48, y: 500, size: 20, font: bold, color: rgb(0.13, 0.11, 0.09) });
    let y = 460;
    for (let l = 0; l < 16; l++) {
      page.drawText(`Line ${l + 1} of page ${i} — three gulls, unmoving, on the last post of the pier.`, {
        x: 48,
        y,
        size: 10,
        font,
        color: rgb(0.2, 0.18, 0.15),
      });
      y -= 22;
    }
    page.drawText(String(i), { x: 200, y: 24, size: 10, font, color: rgb(0.5, 0.45, 0.4) });
  }

  const bytes = await doc.save();
  writeFileSync(new URL('sample.pdf', OUT_DIR), bytes);
  console.log('wrote sample.pdf', bytes.length, 'bytes');
}

await makeEpub();
await makePdf();
