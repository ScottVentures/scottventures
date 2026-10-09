# ScottPDF local service

ScottPDF's tool pages now use a local, same-origin API. The service does not call the reference site's processing endpoints.

## Start the site on Windows

From this folder, run:

```powershell
.\run_scottpdf.ps1
```

The first run creates `.venv` and installs the pinned packages from `requirements.txt`. Open [http://127.0.0.1:8000](http://127.0.0.1:8000). API documentation is available at [http://127.0.0.1:8000/api/docs](http://127.0.0.1:8000/api/docs).

The server binds to `127.0.0.1` by default. For public hosting, put it behind an HTTPS reverse proxy, send the static site and `/api/` to the same origin, configure `SCOTTPDF_TRUSTED_ORIGINS` with the exact public origins, and add rate limits at the proxy. Do not expose the development server directly to the internet.

## PDF tools

The service implements the site’s file processing flows for merge, split, compression, image conversion, text extraction, Office conversion, page organization, rotation, numbering, watermarks, cropping, text additions, existing form filling, password protection/removal, typed signatures, text redaction, comparison reports, OCR, summaries, translation, Markdown, and HTML-to-PDF. The output goes directly back to the browser; uploaded files are held in a temporary working directory and removed after the response.

Default limits are 100 MB per request, 20 files, and 1,000 pages per PDF. Override these with `SCOTTPDF_MAX_UPLOAD_BYTES`, `SCOTTPDF_MAX_FILES`, and `SCOTTPDF_MAX_PAGES`.

Some tools depend on optional services or engines:

- OCR requires Tesseract plus the requested language data, installed on the server. PyMuPDF invokes Tesseract for OCR and creates a searchable PDF layer. [PyMuPDF OCR setup](https://pymupdf.readthedocs.io/en/latest/recipes-ocr.html)
- Translation uses an OpenAI-compatible chat endpoint; set `SCOTTPDF_AI_API_KEY`, and optionally `SCOTTPDF_AI_BASE_URL` and `SCOTTPDF_AI_MODEL`. Without a key, the summary tool uses a local extractive summary, while translation reports that the AI service is not configured.
- Office-to-PDF uses LibreOffice when `soffice` is installed or `SCOTTPDF_LIBREOFFICE` points to it. Without LibreOffice, the fallback preserves document text but not the full original layout.
- PDF-to-PDF/A needs a dedicated archival conversion and validation engine and is not enabled yet.
- HTML-to-PDF converts semantic HTML; it does not run page JavaScript or fetch linked images and stylesheets.
- PDF-to-Word and PDF-to-Excel extract text. PDF-to-PowerPoint uses page images, so it preserves appearance rather than editable slide content.

Cloud-drive imports, email verification and password reset, subscriptions/payments, and team workflows still need their own OAuth, mail, payment, and account configuration.
