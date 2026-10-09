import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import { usePdfPages } from '../../lib/usePdfPages';
import { PDFDocument, readFileAsArrayBuffer, downloadBlob, baseName } from '../../lib/pdfEngine';
import './Crop.css';

const SIDES = [
  { key: 'top', label: 'Top' },
  { key: 'right', label: 'Right' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'left', label: 'Left' },
];

export default function Crop() {
  const { file, pages, loading, error, load, setError } = usePdfPages();
  const [margins, setMargins] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [busy, setBusy] = useState(false);

  const preview = pages[0];

  async function save() {
    if (!pages.length) return;
    setBusy(true);
    setError('');
    try {
      const buf = await readFileAsArrayBuffer(file);
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      doc.getPages().forEach((page) => {
        const { width, height } = page.getSize();
        const top = (margins.top / 100) * height;
        const bottom = (margins.bottom / 100) * height;
        const left = (margins.left / 100) * width;
        const right = (margins.right / 100) * width;
        page.setCropBox(left, bottom, Math.max(1, width - left - right), Math.max(1, height - top - bottom));
      });
      const bytes = await doc.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName(file.name)}-cropped.pdf`);
    } catch (e) {
      setError('Something went wrong: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell icon="crop" title="Crop PDF" description="Trim the margins on every page. Drag the sliders and preview the result on the first page.">
      {!file && <FileDrop accept="application/pdf" label="Select a PDF file" onFiles={load} />}
      {loading && <p className="tool-hint">Loading pages…</p>}
      {error && <p className="tool-error">{error}</p>}

      {pages.length > 0 && (
        <div className="crop-layout">
          <div className="crop-preview">
            <div className="crop-preview__frame">
              <img src={preview.dataUrl} alt="Preview" />
              <div
                className="crop-preview__mask"
                style={{
                  top: `${margins.top}%`,
                  right: `${margins.right}%`,
                  bottom: `${margins.bottom}%`,
                  left: `${margins.left}%`,
                }}
              />
            </div>
          </div>
          <div className="crop-controls">
            {SIDES.map(({ key, label }) => (
              <label key={key} className="crop-slider">
                <span>{label}: {margins[key]}%</span>
                <input
                  type="range" min="0" max="45" value={margins[key]}
                  onChange={(e) => setMargins((m) => ({ ...m, [key]: Number(e.target.value) }))}
                />
              </label>
            ))}
            <div className="tool-actions" style={{ marginTop: 20 }}>
              <Button variant="primary" size="lg" disabled={busy} onClick={save}>
                {busy ? 'Saving…' : 'Save cropped PDF'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
