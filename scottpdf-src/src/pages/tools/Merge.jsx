import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import {
  PDFDocument, readFileAsArrayBuffer, downloadBlob,
} from '../../lib/pdfEngine';
import './list-tool.css';

export default function Merge() {
  const [items, setItems] = useState([]); // [{ id, file, pageCount }]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function addFiles(files) {
    setError('');
    const next = [];
    for (const file of files) {
      try {
        const buf = await readFileAsArrayBuffer(file);
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        next.push({ id: `${file.name}-${file.lastModified}-${Math.random()}`, file, pageCount: doc.getPageCount() });
      } catch {
        setError(`Couldn't read "${file.name}" — is it a valid PDF?`);
      }
    }
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

  async function merge() {
    if (items.length < 2) return;
    setBusy(true);
    setError('');
    try {
      const out = await PDFDocument.create();
      for (const it of items) {
        const buf = await readFileAsArrayBuffer(it.file);
        const src = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      const bytes = await out.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
    } catch (e) {
      setError('Something went wrong while merging: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell icon="merge" title="Merge PDF" description="Combine PDFs in the order you want. Drag files into place, then merge.">
      <FileDrop accept="application/pdf" multiple label="Select PDF files" hint="or drop them here — add as many as you like" onFiles={addFiles} />

      {items.length > 0 && (
        <ul className="list-tool">
          {items.map((it, i) => (
            <li key={it.id} className="list-tool__row">
              <span className="list-tool__icon"><Icon name="doc" size={20} /></span>
              <span className="list-tool__name">{it.file.name}</span>
              <span className="list-tool__meta">{it.pageCount} pages</span>
              <span className="list-tool__actions">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
                <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
                <button type="button" onClick={() => remove(it.id)} title="Remove">✕</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="tool-error">{error}</p>}

      <div className="tool-actions">
        <Button variant="primary" size="lg" disabled={items.length < 2 || busy} onClick={merge}>
          {busy ? 'Merging…' : `Merge ${items.length || ''} PDFs`}
        </Button>
        {items.length === 1 && <p className="tool-hint">Add at least one more PDF to merge.</p>}
      </div>
    </ToolShell>
  );
}
