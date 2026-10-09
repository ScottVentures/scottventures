import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// This app is served at /scottpdf/* by the main ScottVentures server
// (see Backend/server.js), so every asset path needs that prefix.
//
// pdfjs-dist's worker is loaded from a plain URL at runtime, not through
// an import, so it can't go through Vite's module graph — a copy of it
// lives directly in public/assets/pdf.worker.min.mjs (kept in sync with
// the installed pdfjs-dist version; see package.json) so it's served
// as-is at build time.
// https://vite.dev/config/
export default defineConfig({
  base: '/scottpdf/',
  plugins: [react()],
  build: {
    outDir: '../scottpdf',
    emptyOutDir: true,
  },
})
