import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import useImageFile from '../../lib/useImageFile';
import { canvasFrom, canvasToBlob, downloadBlob, baseName, MIME_BY_EXT, extFor } from '../../lib/imgEngine';

const POSITIONS = {
  'top-left': { x: 0.05, y: 0.08, align: 'left' },
  'top-right': { x: 0.95, y: 0.08, align: 'right' },
  center: { x: 0.5, y: 0.5, align: 'center' },
  'bottom-left': { x: 0.05, y: 0.94, align: 'left' },
  'bottom-right': { x: 0.95, y: 0.94, align: 'right' },
};

export default function Watermark() {
  const { file, img, loading, error, load, reset } = useImageFile();
  const [text, setText] = useState('ScottVentures');
  const [opacity, setOpacity] = useState(50);
  const [position, setPosition] = useState('bottom-right');
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!img || !file || !text.trim()) return;
    setBusy(true);
    try {
      const canvas = canvasFrom(img.img, img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img.img, 0, 0, img.width, img.height);

      const fontSize = Math.round(img.width * 0.04);
      ctx.font = `700 ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = `rgba(255,255,255,${opacity / 100})`;
      ctx.strokeStyle = `rgba(0,0,0,${opacity / 200})`;
      ctx.lineWidth = Math.max(1, fontSize * 0.04);

      const pos = POSITIONS[position];
      ctx.textAlign = pos.align;
      ctx.textBaseline = 'middle';
      const px = pos.x * img.width;
      const py = pos.y * img.height;
      ctx.strokeText(text, px, py);
      ctx.fillText(text, px, py);

      const ext = extFor(file.type);
      const mime = MIME_BY_EXT[ext] || 'image/png';
      const blob = await canvasToBlob(canvas, mime, mime === 'image/jpeg' ? 0.92 : undefined);
      downloadBlob(blob, `${baseName(file.name)}-watermarked.${ext}`);
    } finally {
      setBusy(false);
    }
  }

  const pos = POSITIONS[position];

  return (
    <ToolShell title="Watermark IMAGE" description="Stamp text or a logo across one image or a whole batch at once.">
      {!img && (
        <FileDrop accept="image/*" label={loading ? 'Loading…' : 'Select image'} onFiles={load} />
      )}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {img && (
        <div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
            <div style={{ position: 'relative', maxWidth: 320 }}>
              <img src={img.url} alt="preview" style={{ maxWidth: 320, display: 'block', borderRadius: 12 }} />
              <span
                style={{
                  position: 'absolute',
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  transform: `translate(${pos.align === 'right' ? '-100%' : pos.align === 'center' ? '-50%' : '0'}, -50%)`,
                  color: `rgba(255,255,255,${opacity / 100})`,
                  fontWeight: 700,
                  textShadow: '0 1px 3px rgba(0,0,0,.5)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {text || 'Watermark'}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Watermark text</label>
              <input
                type="text" value={text} onChange={(e) => setText(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--divider)', marginBottom: 16, fontSize: 14 }}
              />
              <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Opacity — {opacity}%</label>
              <input type="range" min="10" max="100" value={opacity} onChange={(e) => setOpacity(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />
              <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Position</label>
              <select value={position} onChange={(e) => setPosition(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--divider)' }}>
                {Object.keys(POSITIONS).map((k) => <option key={k} value={k}>{k.replace('-', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button onClick={run} disabled={busy || !text.trim()}>{busy ? 'Applying…' : 'Watermark & download'}</Button>
            <Button variant="ghost" onClick={reset}>Start over</Button>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
