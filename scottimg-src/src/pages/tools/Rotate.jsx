import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import useImageFile from '../../lib/useImageFile';
import { drawTransformed, canvasToBlob, downloadBlob, baseName, MIME_BY_EXT, extFor } from '../../lib/imgEngine';

export default function Rotate() {
  const { file, img, loading, error, load, reset } = useImageFile();
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!img || !file) return;
    setBusy(true);
    try {
      const canvas = drawTransformed(img.img, img.width, img.height, { rotation, flipH, flipV });
      const ext = extFor(file.type);
      const mime = MIME_BY_EXT[ext] || 'image/png';
      const blob = await canvasToBlob(canvas, mime, mime === 'image/jpeg' ? 0.92 : undefined);
      downloadBlob(blob, `${baseName(file.name)}-rotated.${ext}`);
    } finally {
      setBusy(false);
    }
  }

  const previewTransform = `rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`;

  return (
    <ToolShell title="Rotate IMAGE" description="Rotate or flip one image, or a whole batch, in a couple of clicks.">
      {!img && (
        <FileDrop accept="image/*" label={loading ? 'Loading…' : 'Select image'} onFiles={load} />
      )}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {img && (
        <div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
            <div style={{ width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img
                src={img.url}
                alt="preview"
                style={{ maxWidth: 240, maxHeight: 240, borderRadius: 12, transform: previewTransform, transition: 'transform .2s ease' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={() => setRotation((r) => (r - 90 + 360) % 360)}>⟲ Rotate left</Button>
                <Button variant="secondary" size="sm" onClick={() => setRotation((r) => (r + 90) % 360)}>⟳ Rotate right</Button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={() => setFlipH((v) => !v)}>{flipH ? '✓ ' : ''}Flip horizontal</Button>
                <Button variant="secondary" size="sm" onClick={() => setFlipV((v) => !v)}>{flipV ? '✓ ' : ''}Flip vertical</Button>
              </div>
              <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Current rotation: {rotation}°</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button onClick={run} disabled={busy}>{busy ? 'Applying…' : 'Rotate & download'}</Button>
            <Button variant="ghost" onClick={reset}>Start over</Button>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
