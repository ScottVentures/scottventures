import { useCallback, useState } from 'react';
import { loadImage } from './imgEngine';

// Shared "load one image, show a preview, track basic state" hook used
// by every single-image ScottImg tool.
export default function useImageFile() {
  const [file, setFile] = useState(null);
  const [img, setImg] = useState(null); // { img, url, width, height }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (files) => {
    const f = files[0];
    if (!f) return;
    setLoading(true);
    setError('');
    try {
      const loaded = await loadImage(f);
      setFile(f);
      setImg(loaded);
    } catch {
      setError('Could not read that image. Try a different file.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    if (img?.url) URL.revokeObjectURL(img.url);
    setFile(null);
    setImg(null);
    setError('');
  }, [img]);

  return { file, img, loading, error, busy, setBusy, setError, load, reset };
}
