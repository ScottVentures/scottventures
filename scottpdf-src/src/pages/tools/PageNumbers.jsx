import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import { usePdfPages } from '../../lib/usePdfPages';
import { PDFDocument, StandardFonts, rgb, readFileAsArrayBuffer, downloadBlob, baseName } from '../../lib/pdfEngine';
import './PageNumbers.css';

const POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

export default function PageNumbers() {
  const { file, pages, loading, error, load, setError } = usePdfPages();
  const [position, setPosition] = useState('bottom-center');
  const [startAt, setStartAt] = useState(1);
  const [fontSize, setFontSize] = useState(11);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!pages.length) return;
    setBusy(true);
    setError('');
    try {
      const buf = await readFileAsArrayBuffer(file);
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const margin = 28;
      doc.getPages().forEach((page, i) => {
        const { width, height } = page.getSize();
        const text = String(startAt + i);
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        let x = width / 2 - textWidth / 2;
        let y = margin;
        if (position.startsWith('top')) y = height - margin;
        if (position.endsWith('left')) x = margin;
        if (position.endsWith('right')) x = width - margin - textWidth;
        page.drawText(text, { x, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
      });
      const bytes = await doc.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName(file.name)}-numbered.pdf`);
    } catch (e) {
      setError('Something went wrong: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell icon="hash" title="Add page numbers" description="Insert page numbers wherever you like, starting from any number.">
      {!file && <FileDrop accept="application/pdf" label="Select a PDF file" onFiles={load} />}
      {loading && <p className="tool-hint">Loading pages…</p>}
      {error && <p className="tool-error">{error}</p>}

      {pages.length > 0 && (
        <>
          <div className="pn-grid">
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                className={`pn-pos${position === p ? ' pn-pos--active' : ''}`}
                onClick={() => setPosition(p)}
              >
                <span className={`pn-pos__dot pn-pos__dot--${p}`} />
              </button>
            ))}
          </div>
          <div className="pn-fields">
            <label>Start at
              <input type="number" min="1" value={startAt} onChange={(e) => setStartAt(Number(e.target.value) || 1)} />
            </label>
            <label>Font size
              <input type="number" min="8" max="36" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value) || 11)} />
            </label>
          </div>
          <div className="tool-actions">
            <Button variant="primary" size="lg" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Add page numbers'}
            </Button>
          </div>
        </>
      )}
    </ToolShell>
  );
}
