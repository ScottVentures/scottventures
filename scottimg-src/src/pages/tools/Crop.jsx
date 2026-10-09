import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import useImageFile from '../../lib/useImageFile';
import { canvasFrom, canvasToBlob, downloadBlob, baseName, MIME_BY_EXT, extFor } from '../../lib/imgEngine';

export default function Crop() {
  const { file, img, loading, error, load, reset } = useImageFile();
  const [margins, setMargins] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [busy, setBusy] = useState(false);

  function setMargin(side, value) {
    setMargins((m) => ({ ...m, [side]: Math.min(45, Math.max(0, Number(value))) }));
  }

  async function run() {
    if (!img || !file) return;
    setBusy(true);
    try {
      const left = Math.round((margins.left / 100) * img.width);
      const right = Math.round((margins.right / 100) * img.width);
      const top = Math.round((margins.top / 100) * img.height);
      const bottom = Math.round((margins.bottom / 100) * img.height);
      const w = Math.max(1, img.width - left - right);
      const h = Math.max(1, img.height - top - bottom);
      const canvas = canvasFrom(img.img, w, h);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img.img, left, top, w, h, 0, 0, w, h);
      const ext = extFor(file.type);
      const mime = MIME_BY_EXT[ext] || 'image/png';
      const blob = await canvasToBlob(canvas, mime, mime === 'image/jpeg' ? 0.92 : undefined);
      downloadBlob(blob, `${baseName(file.name)}-cropped.${ext}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell title="Crop IMAGE" description="Trim an image down to just the part you want, with a live preview.">
      {!img && (
        <FileDrop accept="image/*" label={loading ? 'Loading…' : 'Select image'} onFiles={load} />
      )}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {img && (
        <div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
            <div style={{ position: 'relative', maxWidth: 320 }}>
              <img src={img.url} alt="preview" style={{ maxWidth: 320, display: 'block', borderRadius: 12 }} />
              <div
                style={{
                  position: 'absolute',
                  top: `${margins.top}%`,
                  left: `${margins.left}%`,
                  right: `${margins.right}%`,
                  bottom: `${margins.bottom}%`,
                  border: '2px dashed #fff',
                  boxShadow: '0 0 0 999px rgba(0,0,0,.35)',
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              {['top', 'right', 'bottom', 'left'].map((side) => (
                <div key={side} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, color: 'var(--ink-soft)', textTransform: 'capitalize' }}>
                    {side} margin — {margins[side]}%
                  </label>
                  <input
                    type="range" min="0" max="45" value={margins[side]}
                    onChange={(e) => setMargin(side, e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button onClick={run} disabled={busy}>{busy ? 'Cropping…' : 'Crop & download'}</Button>
            <Button variant="ghost" onClick={reset}>Start over</Button>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
