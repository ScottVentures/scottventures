// Shared PDF plumbing used by every tool page: reading files, rendering
// page thumbnails with pdf.js, and the pdf-lib helpers for actually
// producing a new PDF. Keeping this in one place means every tool
// manipulates pages the same way instead of each re-inventing it.

import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `${import.meta.env.BASE_URL}assets/pdf.worker.min.mjs`;

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Renders every page of a PDF (given as an ArrayBuffer) to a thumbnail
// data URL. Returns [{ index, dataUrl, width, height, rotation }].
export async function renderThumbnails(arrayBuffer, { maxWidth = 220 } = {}) {
  // pdf.js detaches/transfers the buffer it's given, so hand it a copy —
  // callers usually still need the original bytes afterward (pdf-lib
  // reads the same file independently).
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = maxWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({
      index: i - 1,
      dataUrl: canvas.toDataURL('image/jpeg', 0.82),
      width: viewport.width,
      height: viewport.height,
      rotation: 0,
    });
  }
  await doc.destroy();
  return pages;
}

// Full-resolution render of one page, used by "PDF to JPG".
export async function renderPageToDataUrl(arrayBuffer, pageIndex, { scale = 2 } = {}) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  await doc.destroy();
  return canvas.toDataURL('image/jpeg', 0.92);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function baseName(fileName, fallback = 'document') {
  const name = (fileName || fallback).replace(/\.pdf$/i, '');
  return name || fallback;
}

export { PDFDocument, degrees, rgb, StandardFonts };
