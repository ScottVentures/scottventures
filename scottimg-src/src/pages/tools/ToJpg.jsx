import { useState } from 'react';
import JSZip from 'jszip';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import { loadImage, canvasFrom, canvasToBlob, downloadBlob, baseName } from '../../lib/imgEngine';

export default function ToJpg() {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function onFiles(list) {
    setError('');
    setFiles(list);
  }

  async function toJpgBlob(file) {
    const { img, width, height, url } = await loadImage(file);
    const canvas = canvasFrom(img, width, height);
    const ctx = canvas.getContext('2d');
    // Flatten transparency onto white — JPEG has no alpha channel.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    return canvasToBlob(canvas, 'image/jpeg', 0.92);
  }

  async function run() {
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      if (files.length === 1) {
        const blob = await toJpgBlob(files[0]);
        downloadBlob(blob, `${baseName(files[0].name)}.jpg`);
      } else {
        const zip = new JSZip();
        for (const f of files) {
          const blob = await toJpgBlob(f);
          zip.file(`${baseName(f.name)}.jpg`, blob);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, 'converted-to-jpg.zip');
      }
    } catch {
      setError('One of those files could not be converted. Try a different image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell title="Convert to JPG" description="Turn PNG, WEBP, GIF, BMP and more into JPG images.">
      {!files.length && (
        <FileDrop accept="image/*" multiple label="Select images" onFiles={onFiles} />
      )}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {files.length > 0 && (
        <div>
          <p style={{ color: 'var(--ink-soft)' }}>{files.length} image{files.length > 1 ? 's' : ''} selected</p>
          <ul style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
            {files.map((f) => <li key={f.name}>{f.name}</li>)}
          </ul>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button onClick={run} disabled={busy}>
              {busy ? 'Converting…' : `Convert ${files.length > 1 ? 'to ZIP' : 'to JPG'}`}
            </Button>
            <Button variant="ghost" onClick={() => setFiles([])}>Start over</Button>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
