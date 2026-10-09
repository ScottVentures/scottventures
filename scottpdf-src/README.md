# ScottPdf

The source for ScottVentures' PDF tools app. Built with React + Vite,
using [`pdf-lib`](https://pdf-lib.js.org/) and
[`pdf.js`](https://mozilla.github.io/pdf.js/) to do every PDF operation
entirely in the visitor's browser — nothing is uploaded to a server.

## Develop

```
npm install
npm run dev
```

Opens a dev server (the login guard in `src/AuthGuard.jsx` calls
`/api/auth/me`, so run this alongside the main site's `Backend/server.js`
if you want sign-in to actually work while developing — otherwise it'll
just keep redirecting to the login page).

## Build

```
npm run build
```

Builds straight into `../scottpdf` (see `vite.config.js`'s `outDir`),
which is what `Backend/server.js` serves at `/scottpdf/*`. Refresh the
site after building to see the new version.

## Adding a new tool

1. Add an entry to `src/lib/tools.js` (icon, category, blurb).
2. Build the page under `src/pages/tools/`, using `usePdfPages` (see
   `Organize.jsx` or `Rotate.jsx`) if it works on a single PDF's pages,
   or roll your own state (see `Merge.jsx`) if it doesn't fit that shape.
3. Wire the route in `src/App.jsx`.
4. Flip that tool's `status` in `tools.js` from `'soon'` to `'ready'` and
   give it a `path` — it'll disappear from the "Coming soon" list and
   become clickable on the hub automatically.

## What's real vs. "Coming soon"

Merge, Split, Organize, Rotate, Compress, Crop, Watermark, Add page
numbers, JPG to PDF, and PDF to JPG are fully working, client-side, no
server involved. Everything else on the hub (Office conversions, OCR,
Sign, Forms, the AI tools, etc.) is a placeholder — those either need a
server-side step (LibreOffice headless for Office↔PDF, an OCR engine, an
LLM call for the AI tools) or significantly more UI (a real PDF editor
for Edit/Sign/Forms) that didn't fit in the first pass. See `ComingSoon.jsx`.

## Compress, honestly

`Compress.jsx` tries two approaches and keeps whichever produces the
smaller file: a lossless re-save (which is the only real win for
text-heavy PDFs, since there's no image data to re-encode) and a
rasterized version at the chosen quality level (which is where the big
wins come from for scanned pages or photos). It never ships a "compressed"
file that's actually bigger than the original.
