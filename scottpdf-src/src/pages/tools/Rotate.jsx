import { useState } from 'react';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import PageGrid from '../../components/PageGrid';
import Button from '../../components/Button';
import { usePdfPages } from '../../lib/usePdfPages';
import { PDFDocument, degrees, readFileAsArrayBuffer, downloadBlob, baseName } from '../../lib/pdfEngine';

export default function Rotate() {
  const { file, pages, loading, error, load, rotate, rotateAll, setError } = usePdfPages();
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!pages.length) return;
    setBusy(true);
    setError('');
    try {
      const buf = await readFileAsArrayBuffer(file);
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const list = doc.getPages();
      pages.forEach((p) => {
        if (p.rotation) list[p.index].setRotation(degrees((list[p.index].getRotation().angle + p.rotation) % 360));
      });
      const bytes = await doc.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName(file.name)}-rotated.pdf`);
    } catch (e) {
      setError('Something went wrong: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell icon="rotate" title="Rotate PDF" description="Rotate individual pages, or everything at once — then save.">
      {!file && <FileDrop accept="application/pdf" label="Select a PDF file" onFiles={load} />}
      {loading && <p className="tool-hint">Loading pages…</p>}
      {error && <p className="tool-error">{error}</p>}

      {pages.length > 0 && (
        <>
          <div className="tool-actions" style={{ marginTop: 0, marginBottom: 20 }}>
            <Button variant="secondary" size="sm" onClick={() => rotateAll(90)}>Rotate all 90°</Button>
            {' '}
            <Button variant="secondary" size="sm" onClick={() => rotateAll(-90)}>Rotate all -90°</Button>
          </div>
          <PageGrid pages={pages} onRotate={rotate} selectable={false} />
          <div className="tool-actions">
            <Button variant="primary" size="lg" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save rotated PDF'}
            </Button>
          </div>
        </>
      )}
    </ToolShell>
  );
}
