import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import { usePdfPages } from '../../lib/usePdfPages';
import { PDFDocument, StandardFonts, rgb, degrees, readFileAsArrayBuffer, downloadBlob, baseName } from '../../lib/pdfEngine';
import './Watermark.css';

export default function Watermark() {
  const { file, pages, loading, error, load, setError } = usePdfPages();
  const [text, setText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(0.25);
  const [fontSize, setFontSize] = useState(48);
  const [rotation, setRotation] = useState(45);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!pages.length || !text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const buf = await readFileAsArrayBuffer(file);
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      doc.getPages().forEach((page) => {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(0.6, 0.1, 0.1),
          opacity,
          rotate: degrees(rotation),
        });
      });
      const bytes = await doc.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName(file.name)}-watermarked.pdf`);
    } catch (e) {
      setError('Something went wrong: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell icon="watermark" title="Watermark" description="Stamp text over every page — set the wording, size, angle and opacity.">
      {!file && <FileDrop accept="application/pdf" label="Select a PDF file" onFiles={load} />}
      {loading && <p className="tool-hint">Loading pages…</p>}
      {error && <p className="tool-error">{error}</p>}

      {pages.length > 0 && (
        <div className="wm-layout">
          <div className="wm-preview">
            <div className="wm-preview__frame">
              <img src={pages[0].dataUrl} alt="Preview" />
              <div
                className="wm-preview__text"
                style={{ opacity, transform: `translate(-50%, -50%) rotate(${-rotation}deg)`, fontSize: fontSize / 2.4 }}
              >
                {text || ' '}
              </div>
            </div>
          </div>
          <div className="wm-controls">
            <label>Text
              <input type="text" value={text} onChange={(e) => setText(e.target.value)} maxLength={60} />
            </label>
            <label>Font size: {fontSize}
              <input type="range" min="16" max="96" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
            </label>
            <label>Opacity: {Math.round(opacity * 100)}%
              <input type="range" min="5" max="80" value={opacity * 100} onChange={(e) => setOpacity(Number(e.target.value) / 100)} />
            </label>
            <label>Rotation: {rotation}°
              <input type="range" min="0" max="90" value={rotation} onChange={(e) => setRotation(Number(e.target.value))} />
            </label>
            <div className="tool-actions" style={{ marginTop: 8 }}>
              <Button variant="primary" size="lg" disabled={busy || !text.trim()} onClick={save}>
                {busy ? 'Applying…' : 'Apply watermark'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
