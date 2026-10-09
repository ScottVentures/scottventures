import { useState, useCallback } from 'react';
import { readFileAsArrayBuffer, renderThumbnails } from './pdfEngine';

// Shared state for "load one PDF, work with its pages" tools (Organize,
// Rotate, Split, Crop, Watermark, Page numbers). Keeps the original file
// bytes (pdf-lib needs a fresh read of those to actually build the
// output) plus a lightweight thumbnail/rotation/selection model for the
// UI to render and manipulate.
export function usePdfPages() {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]); // { index, dataUrl, rotation, selected }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (files) => {
    const f = files[0];
    if (!f) return;
    setLoading(true);
    setError('');
    try {
      const buf = await readFileAsArrayBuffer(f);
      const rendered = await renderThumbnails(buf);
      setFile(f);
      setPages(rendered.map((p) => ({ ...p, rotation: 0, selected: false })));
    } catch {
      setError(`Couldn't read "${f.name}" — is it a valid PDF?`);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setPages([]);
    setError('');
  }, []);

  const toggle = useCallback((index) => {
    setPages((cur) => cur.map((p) => (p.index === index ? { ...p, selected: !p.selected } : p)));
  }, []);

  const rotate = useCallback((index, by = 90) => {
    setPages((cur) => cur.map((p) => (p.index === index ? { ...p, rotation: ((p.rotation || 0) + by + 360) % 360 } : p)));
  }, []);

  const rotateAll = useCallback((by = 90) => {
    setPages((cur) => cur.map((p) => ({ ...p, rotation: ((p.rotation || 0) + by + 360) % 360 })));
  }, []);

  const remove = useCallback((index) => {
    setPages((cur) => cur.filter((p) => p.index !== index));
  }, []);

  const reorder = useCallback((from, to) => {
    setPages((cur) => {
      const arr = [...cur];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  }, []);

  return { file, pages, loading, error, load, reset, toggle, rotate, rotateAll, remove, reorder, setError };
}
