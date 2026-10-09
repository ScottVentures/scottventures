import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import useImageFile from '../../lib/useImageFile';
import { canvasFrom, canvasToBlob, downloadBlob, baseName } from '../../lib/imgEngine';

const FORMATS = {
  png: { mime: 'image/png', label: 'PNG' },
  webp: { mime: 'image/webp', label: 'WEBP' },
};

export default function FromJpg() {
  const { file, img, loading, error, load, reset } = useImageFile();
  const [format, setFormat] = useState('png');
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!img || !file) return;
    setBusy(true);
    try {
      const canvas = canvasFrom(img.img, img.width, img.height);
      canvas.getContext('2d').drawImage(img.img, 0, 0, img.width, img.height);
      const blob = await canvasToBlob(canvas, FORMATS[format].mime);
      downloadBlob(blob, `${baseName(file.name)}.${format}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell title="Convert from JPG" description="Turn a JPG photo into PNG or WEBP format.">
      {!img && (
        <FileDrop accept="image/jpeg" label={loading ? 'Loading…' : 'Select a JPG'} onFiles={load} />
      )}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {img && (
        <div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
            <img src={img.url} alt="preview" style={{ maxWidth: 260, maxHeight: 260, borderRadius: 12, border: '1px solid var(--divider)' }} />
            <div>
              <p style={{ marginTop: 0, color: 'var(--ink-soft)' }}>{file.name} — {img.width}×{img.height}px</p>
              <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 10 }}>Convert to:</p>
              {Object.entries(FORMATS).map(([key, meta]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="radio" checked={format === key} onChange={() => setFormat(key)} />
                  {meta.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button onClick={run} disabled={busy}>{busy ? 'Converting…' : `Convert to ${FORMATS[format].label}`}</Button>
            <Button variant="ghost" onClick={reset}>Start over</Button>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
