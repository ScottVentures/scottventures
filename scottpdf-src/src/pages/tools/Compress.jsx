import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import {
  PDFDocument, readFileAsArrayBuffer, renderPageToDataUrl, downloadBlob, baseName,
} from '../../lib/pdfEngine';
import * as pdfjsLib from 'pdfjs-dist';
import './Compress.css';

const LEVELS = {
  low: { scale: 2, quality: 0.85, label: 'Low — best quality' },
  medium: { scale: 1.4, quality: 0.68, label: 'Medium — recommended' },
  high: { scale: 1.0, quality: 0.5, label: 'High — smallest file' },
};

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default function Compress() {
  const [file, setFile] = useState(null);
  const [originalSize, setOriginalSize] = useState(0);
  const [level, setLevel] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function onFiles(files) {
    setFile(files[0]);
    setOriginalSize(files[0].size);
    setResult(null);
    setError('');
  }

  async function compress() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const buf = await readFileAsArrayBuffer(file);
      const { scale, quality } = LEVELS[level];

      // Two candidates, and we keep whichever is actually smaller:
      //
      // 1. A lossless re-save (pdf-lib's object-stream compression) —
      //    strips redundant structure without touching a single pixel.
      //    This is often the *only* real win for text-heavy documents,
      //    where there's no image data to re-encode in the first place.
      // 2. A rasterized version — every page re-drawn as a JPEG at the
      //    chosen scale/quality. This is where the big wins come from
      //    for scanned pages or photo-heavy PDFs, but it can't do
      //    anything for a page that was already just text and vectors,
      //    and can even make a tiny, simple PDF *larger* (a full-page
      //    JPEG of a mostly-blank page outweighs a few lines of text).
      //
      // Rather than ship a tool that sometimes makes files bigger, we
      // always compare the two outcomes and hand back the smaller one.
      const losslessSrc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const losslessBytes = await losslessSrc.save({ useObjectStreams: true });

      const doc = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      const rasterOut = await PDFDocument.create();
      for (let i = 1; i <= doc.numPages; i++) {
        const dataUrl = await renderPageToDataUrl(buf, i - 1, { scale });
        const jpgBytes = dataUrlToBytes(dataUrl);
        const img = await rasterOut.embedJpg(jpgBytes);
        const page = rasterOut.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      await doc.destroy();
      const rasterBytes = await rasterOut.save();

      const useRaster = rasterBytes.length < losslessBytes.length;
      const bytes = useRaster ? rasterBytes : losslessBytes;
      const blob = new Blob([bytes], { type: 'application/pdf' });
      setResult({ blob, size: blob.size, method: useRaster ? 'raster' : 'lossless' });
    } catch (e) {
      setError('Something went wrong while compressing: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (result) downloadBlob(result.blob, `${baseName(file.name)}-compressed.pdf`);
  }

  const savedPct = result && originalSize
    ? Math.max(0, Math.round((1 - result.size / originalSize) * 100))
    : null;

  return (
    <ToolShell icon="compress" title="Compress PDF" description="Reduce file size by re-encoding each page at the quality level you choose.">
      {!file && <FileDrop accept="application/pdf" label="Select a PDF file" onFiles={onFiles} />}

      {file && (
        <>
          <p className="tool-hint">{file.name} — {(originalSize / 1024 / 1024).toFixed(2)} MB</p>

          <div className="compress-levels">
            {Object.entries(LEVELS).map(([key, cfg]) => (
              <label key={key} className={`compress-level${level === key ? ' compress-level--active' : ''}`}>
                <input type="radio" name="level" value={key} checked={level === key} onChange={() => setLevel(key)} />
                {cfg.label}
              </label>
            ))}
          </div>

          {error && <p className="tool-error">{error}</p>}

          {!result ? (
            <div className="tool-actions">
              <Button variant="primary" size="lg" disabled={busy} onClick={compress}>
                {busy ? 'Compressing…' : 'Compress PDF'}
              </Button>
            </div>
          ) : (
            <div className="tool-actions">
              <p className="tool-hint">
                New size: {(result.size / 1024 / 1024).toFixed(2)} MB
                {savedPct !== null && savedPct > 0
                  ? ` (${savedPct}% smaller)`
                  : ' — this PDF was already about as small as it can get without losing quality.'}
              </p>
              <Button variant="primary" size="lg" onClick={download}>Download compressed PDF</Button>
              {' '}
              <Button variant="ghost" size="lg" onClick={() => setResult(null)}>Try another level</Button>
            </div>
          )}
        </>
      )}
    </ToolShell>
  );
}
