import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import useImageFile from '../../lib/useImageFile';
import { canvasFrom, canvasToBlob, downloadBlob, baseName, MIME_BY_EXT, extFor } from '../../lib/imgEngine';

export default function Resize() {
  const { file, img, loading, error, load, reset } = useImageFile();
  const [mode, setMode] = useState('percent'); // percent | exact
  const [percent, setPercent] = useState(50);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [keepRatio, setKeepRatio] = useState(true);
  const [busy, setBusy] = useState(false);

  function onWidthChange(v) {
    setWidth(v);
    if (keepRatio && img && v) {
      setHeight(Math.round((Number(v) / img.width) * img.height));
    }
  }
  function onHeightChange(v) {
    setHeight(v);
    if (keepRatio && img && v) {
      setWidth(Math.round((Number(v) / img.height) * img.width));
    }
  }

  function targetSize() {
    if (!img) return null;
    if (mode === 'percent') {
      const f = Math.max(1, Number(percent)) / 100;
      return { w: Math.max(1, Math.round(img.width * f)), h: Math.max(1, Math.round(img.height * f)) };
    }
    const w = Math.max(1, Number(width) || img.width);
    const h = Math.max(1, Number(height) || img.height);
    return { w, h };
  }

  async function run() {
    if (!img || !file) return;
    setBusy(true);
    try {
      const { w, h } = targetSize();
      const canvas = canvasFrom(img.img, w, h);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img.img, 0, 0, w, h);
      const ext = extFor(file.type);
      const mime = MIME_BY_EXT[ext] || 'image/png';
      const blob = await canvasToBlob(canvas, mime, mime === 'image/jpeg' ? 0.92 : undefined);
      downloadBlob(blob, `${baseName(file.name)}-resized.${ext}`);
    } finally {
      setBusy(false);
    }
  }

  const size = targetSize();

  return (
    <ToolShell
      title="Resize IMAGE"
      description="Change an image's pixel dimensions by exact size or percentage."
    >
      {!img && (
        <FileDrop accept="image/*" label={loading ? 'Loading…' : 'Select image'} onFiles={load} />
      )}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {img && (
        <div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
            <img src={img.url} alt="preview" style={{ maxWidth: 260, maxHeight: 260, borderRadius: 12, border: '1px solid var(--divider)' }} />
            <div style={{ flex: 1, minWidth: 240 }}>
              <p style={{ marginTop: 0, color: 'var(--ink-soft)' }}>
                {file.name} — original {img.width}×{img.height}px
              </p>

              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" checked={mode === 'percent'} onChange={() => setMode('percent')} /> By percentage
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" checked={mode === 'exact'} onChange={() => setMode('exact')} /> By pixels
                </label>
              </div>

              {mode === 'percent' ? (
                <div>
                  <input
                    type="range" min="1" max="200" value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    style={{ width: '100%' }}
                  />
                  <div style={{ color: 'var(--ink-soft)' }}>{percent}%</div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input type="number" placeholder="Width" value={width} onChange={(e) => onWidthChange(e.target.value)} style={inputStyle} />
                  <span>×</span>
                  <input type="number" placeholder="Height" value={height} onChange={(e) => onHeightChange(e.target.value)} style={inputStyle} />
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--ink-soft)' }}>
                    <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} />
                    Keep ratio
                  </label>
                </div>
              )}

              {size && (
                <p style={{ marginTop: 12, color: 'var(--ink-faint)', fontSize: 14 }}>
                  New size: {size.w}×{size.h}px
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button onClick={run} disabled={busy}>{busy ? 'Resizing…' : 'Resize & download'}</Button>
            <Button variant="ghost" onClick={reset}>Start over</Button>
          </div>
        </div>
      )}
    </ToolShell>
  );
}

const inputStyle = {
  width: 100,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--divider)',
  fontSize: 14,
};
