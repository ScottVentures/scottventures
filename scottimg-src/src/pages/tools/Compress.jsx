import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import useImageFile from '../../lib/useImageFile';
import { canvasFrom, canvasToBlob, downloadBlob, baseName } from '../../lib/imgEngine';

const LEVELS = {
  low: { quality: 0.85, label: 'Low compression', hint: 'Best quality, smaller savings' },
  medium: { quality: 0.68, label: 'Recommended', hint: 'Good balance of size and quality' },
  high: { quality: 0.45, label: 'High compression', hint: 'Smallest file, more visible quality loss' },
};

export default function Compress() {
  const { file, img, loading, error, load, reset } = useImageFile();
  const [level, setLevel] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { blob, originalBytes }

  async function run() {
    if (!img || !file) return;
    setBusy(true);
    setResult(null);
    try {
      const canvas = canvasFrom(img.img, img.width, img.height);
      const ctx = canvas.getContext('2d');
      // Flatten onto white first — PNGs with transparency would otherwise
      // turn black when re-encoded as JPEG.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img.img, 0, 0, img.width, img.height);
      const blob = await canvasToBlob(canvas, 'image/jpeg', LEVELS[level].quality);
      const originalBytes = file.size;
      // Never ship a "compressed" file that's actually bigger.
      const finalBlob = blob.size < originalBytes ? blob : file;
      setResult({ blob: finalBlob, originalBytes, wasSmaller: blob.size < originalBytes });
    } catch {
      // fall through — result stays null, UI shows nothing to download
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!result || !file) return;
    downloadBlob(result.blob, `${baseName(file.name)}-compressed.jpg`);
  }

  return (
    <ToolShell
      title="Compress IMAGE"
      description="Shrink JPG, PNG and WEBP images while keeping the best possible quality."
    >
      {!img && (
        <FileDrop
          accept="image/*"
          label={loading ? 'Loading…' : 'Select image'}
          onFiles={load}
        />
      )}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {img && (
        <div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
            <img
              src={img.url}
              alt="preview"
              style={{ maxWidth: 260, maxHeight: 260, borderRadius: 12, border: '1px solid var(--divider)' }}
            />
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ marginTop: 0, color: 'var(--ink-soft)' }}>
                {file.name} — {img.width}×{img.height}px, {(file.size / 1024).toFixed(1)} KB
              </p>
              {Object.entries(LEVELS).map(([key, meta]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
                  <input type="radio" name="level" checked={level === key} onChange={() => setLevel(key)} />
                  <span>
                    <strong>{meta.label}</strong>
                    <br />
                    <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{meta.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {result && (
            <p style={{ color: 'var(--ink-soft)', marginBottom: 16 }}>
              {result.wasSmaller
                ? `${(result.blob.size / 1024).toFixed(1)} KB — ${Math.round((1 - result.blob.size / result.originalBytes) * 100)}% smaller than the original.`
                : "This image was already about as small as it can get without losing quality, so we kept the original."}
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button onClick={run} disabled={busy}>{busy ? 'Compressing…' : 'Compress'}</Button>
            {result && <Button variant="secondary" onClick={download}>Download</Button>}
            <Button variant="ghost" onClick={reset}>Start over</Button>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
