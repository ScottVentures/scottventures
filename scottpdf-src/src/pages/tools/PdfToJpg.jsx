import { useState } from 'react';
import JSZip from 'jszip';
import ToolShell from '../../components/ToolShell';
import FileDrop from '../../components/FileDrop';
import PageGrid from '../../components/PageGrid';
import Button from '../../components/Button';
import { usePdfPages } from '../../lib/usePdfPages';
import { readFileAsArrayBuffer, renderPageToDataUrl, downloadBlob, baseName } from '../../lib/pdfEngine';

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default function PdfToJpg() {
  const { file, pages, loading, error, load, toggle, setError } = usePdfPages();
  const [busy, setBusy] = useState(false);

  const selected = pages.filter((p) => p.selected);

  async function convert() {
    const list = selected.length ? selected : pages;
    setBusy(true);
    setError('');
    try {
      const buf = await readFileAsArrayBuffer(file);
      if (list.length === 1) {
        const dataUrl = await renderPageToDataUrl(buf, list[0].index);
        downloadBlob(new Blob([dataUrlToBytes(dataUrl)], { type: 'image/jpeg' }), `${baseName(file.name)}-page-${list[0].index + 1}.jpg`);
      } else {
        const zip = new JSZip();
        for (const p of list) {
          const dataUrl = await renderPageToDataUrl(buf, p.index);
          zip.file(`${baseName(file.name)}-page-${p.index + 1}.jpg`, dataUrlToBytes(dataUrl));
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, `${baseName(file.name)}-images.zip`);
      }
    } catch (e) {
      setError('Something went wrong: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell icon="image" title="PDF to JPG" description="Turn every page into a JPG image — or just the ones you pick.">
      {!file && <FileDrop accept="application/pdf" label="Select a PDF file" onFiles={load} />}
      {loading && <p className="tool-hint">Loading pages…</p>}
      {error && <p className="tool-error">{error}</p>}

      {pages.length > 0 && (
        <>
          <p className="tool-hint" style={{ marginBottom: 16 }}>
            {selected.length ? `${selected.length} page(s) selected.` : 'Click pages to select a subset, or convert all of them.'}
          </p>
          <PageGrid pages={pages} onToggle={toggle} selectable />
          <div className="tool-actions">
            <Button variant="primary" size="lg" disabled={busy} onClick={convert}>
              {busy ? 'Converting…' : `Convert ${selected.length || pages.length} page(s) to JPG`}
            </Button>
          </div>
        </>
      )}
    </ToolShell>
  );
}
