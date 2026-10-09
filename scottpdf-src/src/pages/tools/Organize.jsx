import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import PageGrid from '../../components/PageGrid';
import Button from '../../components/Button';
import { usePdfPages } from '../../lib/usePdfPages';
import { PDFDocument, degrees, readFileAsArrayBuffer, downloadBlob, baseName } from '../../lib/pdfEngine';
import '../tools/list-tool.css';

export default function Organize() {
  const { file, pages, loading, error, load, rotate, remove, reorder, setError } = usePdfPages();
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!pages.length) return;
    setBusy(true);
    setError('');
    try {
      const buf = await readFileAsArrayBuffer(file);
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pages.map((p) => p.index));
      copied.forEach((page, i) => {
        const rot = pages[i].rotation || 0;
        if (rot) page.setRotation(degrees((page.getRotation().angle + rot) % 360));
        out.addPage(page);
      });
      const bytes = await out.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName(file.name)}-organized.pdf`);
    } catch (e) {
      setError('Something went wrong: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell icon="organize" title="Organize PDF" description="Drag pages to reorder, rotate any page, or delete the ones you don't need.">
      {!file && (
        <FileDrop accept="application/pdf" label="Select a PDF file" onFiles={load} />
      )}
      {loading && <p className="tool-hint">Loading pages…</p>}
      {error && <p className="tool-error">{error}</p>}

      {pages.length > 0 && (
        <>
          <PageGrid pages={pages} onRotate={rotate} onDelete={remove} onReorder={reorder} selectable={false} />
          <div className="tool-actions">
            <Button variant="primary" size="lg" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save organized PDF'}
            </Button>
          </div>
        </>
      )}
    </ToolShell>
  );
}
