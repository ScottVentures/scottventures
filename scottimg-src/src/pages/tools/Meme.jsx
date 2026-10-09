import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import useImageFile from '../../lib/useImageFile';
import { canvasFrom, canvasToBlob, downloadBlob, baseName } from '../../lib/imgEngine';

function drawCaption(ctx, text, x, y, fontSize, align) {
  ctx.font = `900 ${fontSize}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = fontSize * 0.08;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#fff';
  ctx.strokeText(text.toUpperCase(), x, y);
  ctx.fillText(text.toUpperCase(), x, y);
}

export default function Meme() {
  const { file, img, loading, error, load, reset } = useImageFile();
  const [top, setTop] = useState('TOP TEXT');
  const [bottom, setBottom] = useState('BOTTOM TEXT');
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!img || !file) return;
    setBusy(true);
    try {
      const canvas = canvasFrom(img.img, img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img.img, 0, 0, img.width, img.height);
      const fontSize = Math.round(img.width * 0.09);
      if (top.trim()) drawCaption(ctx, top, img.width / 2, fontSize * 1.1, fontSize, 'center');
      if (bottom.trim()) drawCaption(ctx, bottom, img.width / 2, img.height - fontSize * 0.35, fontSize, 'center');
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
      downloadBlob(blob, `${baseName(file.name)}-meme.jpg`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell title="Meme generator" description="Drop bold top/bottom captions onto any image and download it instantly.">
      {!img && (
        <FileDrop accept="image/*" label={loading ? 'Loading…' : 'Select image'} onFiles={load} />
      )}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {img && (
        <div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
            <div style={{ position: 'relative', maxWidth: 320 }}>
              <img src={img.url} alt="preview" style={{ maxWidth: 320, display: 'block', borderRadius: 12 }} />
              <div style={memeTextStyle('top')}>{top}</div>
              <div style={memeTextStyle('bottom')}>{bottom}</div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Top text</label>
              <input type="text" value={top} onChange={(e) => setTop(e.target.value)} style={fieldStyle} />
              <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Bottom text</label>
              <input type="text" value={bottom} onChange={(e) => setBottom(e.target.value)} style={fieldStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button onClick={run} disabled={busy}>{busy ? 'Creating…' : 'Download meme'}</Button>
            <Button variant="ghost" onClick={reset}>Start over</Button>
          </div>
        </div>
      )}
    </ToolShell>
  );
}

function memeTextStyle(pos) {
  return {
    position: 'absolute',
    left: '50%',
    [pos]: 8,
    transform: 'translateX(-50%)',
    color: '#fff',
    WebkitTextStroke: '1.5px #000',
    fontWeight: 900,
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fontSize: 22,
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '90%',
    pointerEvents: 'none',
  };
}

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--divider)',
  marginBottom: 16,
  fontSize: 14,
};
