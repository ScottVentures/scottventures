import { useState } from 'react';
import JSZip from 'jszip';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import PageGrid from '../../components/PageGrid';
import Button from '../../components/Button';
import { usePdfPages } from '../../lib/usePdfPages';
import { PDFDocument, readFileAsArrayBuffer, downloadBlob, baseName } from '../../lib/pdfEngine';

export default function Split() {
  const { file, pages, loading, error, load, toggle, setError } = usePdfPages();
  const [busy, setBusy] = useState('');

  const selected = pages.filter((p) => p.selected);

  async function extractSelectedAsOne() {
    if (!selected.length) return;
    setBusy('one');
    setError('');
    try {
      const buf = await readFileAsArrayBuffer(file);
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, selected.map((p) => p.index));
      copied.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName(file.name)}-selected.pdf`);
    } catch (e) {
      setError('Something went wrong: ' + e.message);
    } finally {
      setBusy('');
    }
  }

  async function extractEachAsZip() {
    const list = selected.length ? selected : pages;
    setBusy('zip');
    setError('');
    try {
      const buf = await readFileAsArrayBuffer(file);
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const zip = new JSZip();
      for (const p of list) {
        const out = await PDFDocument.create();
        const [copied] = await out.copyPages(src, [p.index]);
        out.addPage(copied);
        const bytes = await out.save();
        zip.file(`${baseName(file.name)}-page-${p.index + 1}.pdf`, bytes);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${baseName(file.name)}-split.zip`);
    } catch (e) {
      setError('Something went wrong: ' + e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <ToolShell icon="split" title="Split PDF" description="Select the pages you want, then pull them out as one file or as separate PDFs.">
      {!file && <FileDrop accept="application/pdf" label="Select a PDF file" onFiles={load} />}
      {loading && <p className="tool-hint">Loading pages…</p>}
      {error && <p className="tool-error">{error}</p>}

      {pages.length > 0 && (
        <>
          <p className="tool-hint" style={{ marginBottom: 16 }}>
            {selected.length ? `${selected.length} page(s) selected.` : 'Click pages to select them (or leave none selected to work with every page).'}
          </p>
          <PageGrid pages={pages} onToggle={toggle} selectable />
          <div className="tool-actions">
            <Button variant="primary" size="lg" disabled={!selected.length || busy} onClick={extractSelectedAsOne}>
              {busy === 'one' ? 'Extracting…' : 'Extract selected pages into one PDF'}
            </Button>
            {' '}
            <Button variant="secondary" size="lg" disabled={!!busy} onClick={extractEachAsZip}>
              {busy === 'zip' ? 'Zipping…' : 'Split each page into separate PDFs (ZIP)'}
            </Button>
          </div>
        </>
      )}
    </ToolShell>
  );
}
