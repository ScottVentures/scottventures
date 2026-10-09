import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import { PDFDocument, readFileAsArrayBuffer, downloadBlob } from '../../lib/pdfEngine';
import '../tools/list-tool.css';

export default function JpgToPdf() {
  const [items, setItems] = useState([]); // { id, file, url }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function addFiles(files) {
    const next = files
      .filter((f) => /^image\//.test(f.type))
      .map((f) => ({ id: `${f.name}-${f.lastModified}-${Math.random()}`, file: f, url: URL.createObjectURL(f) }));
    if (!next.length) { setError('Please choose image files (JPG or PNG).'); return; }
    setError('');
    setItems((cur) => [...cur, ...next]);
  }

  function move(i, dir) {
    setItems((cur) => {
      const arr = [...cur];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return cur;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }

  function remove(id) {
    setItems((cur) => cur.filter((it) => it.id !== id));
  }

  async function convert() {
    if (!items.length) return;
    setBusy(true);
    setError('');
    try {
      const doc = await PDFDocument.create();
      for (const it of items) {
        const buf = await readFileAsArrayBuffer(it.file);
        const isPng = /png/i.test(it.file.type) || /\.png$/i.test(it.file.name);
        const img = isPng ? await doc.embedPng(buf) : await doc.embedJpg(buf);
        const page = doc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      const bytes = await doc.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'images.pdf');
    } catch (e) {
      setError('Something went wrong: ' + e.message + ' (only JPG and PNG are supported right now)');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell icon="image" title="JPG to PDF" description="Turn one or more images into a single PDF, one image per page.">
      <FileDrop accept="image/jpeg,image/png" multiple label="Select images" hint="JPG or PNG — drop several at once" onFiles={addFiles} />

      {items.length > 0 && (
        <ul className="list-tool">
          {items.map((it, i) => (
            <li key={it.id} className="list-tool__row">
              <img src={it.url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
              <span className="list-tool__name">{it.file.name}</span>
              <span className="list-tool__actions">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" onClick={() => remove(it.id)}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="tool-error">{error}</p>}

      <div className="tool-actions">
        <Button variant="primary" size="lg" disabled={!items.length || busy} onClick={convert}>
          {busy ? 'Converting…' : `Convert ${items.length || ''} image${items.length === 1 ? '' : 's'} to PDF`}
        </Button>
      </div>
    </ToolShell>
  );
}
