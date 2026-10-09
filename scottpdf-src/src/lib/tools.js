// Central catalog of every tool ScottPdf offers. Adding a working tool is:
// (1) build the page component, (2) set `status: 'ready'` and `path` here.
// Everything else stays 'soon' and renders through the shared ComingSoon
// page, so the hub always shows the full breadth of what ScottPdf does
// without ever claiming a tool works before it actually does.

export const CATEGORIES = [
  'Organize',
  'Optimize',
  'Convert to PDF',
  'Convert from PDF',
  'Edit',
  'Security',
  'PDF Intelligence',
];

export const TOOLS = [
  // ---- Organize -----------------------------------------------------
  { id: 'merge', name: 'Merge PDF', category: 'Organize', icon: 'merge',
    blurb: 'Combine PDFs in the order you want with the easiest PDF merger available.',
    status: 'ready', path: '/merge' },
  { id: 'split', name: 'Split PDF', category: 'Organize', icon: 'split',
    blurb: 'Separate one page, or a whole set, into independent PDF files.',
    status: 'ready', path: '/split' },
  { id: 'organize', name: 'Organize PDF', category: 'Organize', icon: 'organize',
    blurb: 'Sort, add, delete and rotate PDF pages from a visual page grid.',
    status: 'ready', path: '/organize' },
  { id: 'remove-pages', name: 'Remove pages', category: 'Organize', icon: 'trash',
    blurb: 'Delete one or more pages from a PDF in a few clicks.',
    status: 'soon' },
  { id: 'extract-pages', name: 'Extract pages', category: 'Organize', icon: 'extract',
    blurb: 'Pull a chosen set of pages out of a PDF into a new file.',
    status: 'soon' },
  { id: 'scan-to-pdf', name: 'Scan to PDF', category: 'Organize', icon: 'scan',
    blurb: 'Capture document scans from your device and save them as PDF.',
    status: 'soon' },

  // ---- Optimize -------------------------------------------------------
  { id: 'compress', name: 'Compress PDF', category: 'Optimize', icon: 'compress',
    blurb: 'Reduce file size while keeping the best possible quality.',
    status: 'ready', path: '/compress' },
  { id: 'repair', name: 'Repair PDF', category: 'Optimize', icon: 'repair',
    blurb: 'Recover data from a corrupted PDF and rebuild it into a working file.',
    status: 'soon' },
  { id: 'ocr', name: 'OCR PDF', category: 'Optimize', icon: 'ocr',
    blurb: 'Make a scanned PDF searchable and copy-pasteable.',
    status: 'soon' },

  // ---- Convert to PDF -------------------------------------------------
  { id: 'jpg-to-pdf', name: 'JPG to PDF', category: 'Convert to PDF', icon: 'image',
    blurb: 'Turn JPG, PNG, BMP, GIF and TIFF images into a PDF in seconds.',
    status: 'ready', path: '/jpg-to-pdf' },
  { id: 'word-to-pdf', name: 'Word to PDF', category: 'Convert to PDF', icon: 'word',
    blurb: 'Make DOC and DOCX files easy to read by converting them to PDF.',
    status: 'soon' },
  { id: 'ppt-to-pdf', name: 'PowerPoint to PDF', category: 'Convert to PDF', icon: 'ppt',
    blurb: 'Make PPT and PPTX slideshows easy to view by converting them to PDF.',
    status: 'soon' },
  { id: 'excel-to-pdf', name: 'Excel to PDF', category: 'Convert to PDF', icon: 'excel',
    blurb: 'Make EXCEL spreadsheets easy to read by converting them to PDF.',
    status: 'soon' },
  { id: 'html-to-pdf', name: 'HTML to PDF', category: 'Convert to PDF', icon: 'html',
    blurb: 'Convert any web page into a PDF by pasting in its URL.',
    status: 'soon' },

  // ---- Convert from PDF ------------------------------------------------
  { id: 'pdf-to-jpg', name: 'PDF to JPG', category: 'Convert from PDF', icon: 'image',
    blurb: 'Turn every PDF page into a JPG, or extract every image in a PDF.',
    status: 'ready', path: '/pdf-to-jpg' },
  { id: 'pdf-to-word', name: 'PDF to Word', category: 'Convert from PDF', icon: 'word',
    blurb: 'Turn a PDF into an easy-to-edit DOC file in seconds.',
    status: 'soon' },
  { id: 'pdf-to-ppt', name: 'PDF to PowerPoint', category: 'Convert from PDF', icon: 'ppt',
    blurb: 'Turn a PDF into an editable PowerPoint PPT slideshow.',
    status: 'soon' },
  { id: 'pdf-to-excel', name: 'PDF to Excel', category: 'Convert from PDF', icon: 'excel',
    blurb: 'Pull data straight out of a PDF into an Excel spreadsheet.',
    status: 'soon' },
  { id: 'pdf-to-pdfa', name: 'PDF to PDF/A', category: 'Convert from PDF', icon: 'archive',
    blurb: 'Convert a PDF into the ISO-standardized PDF/A archival format.',
    status: 'soon' },

  // ---- Edit -------------------------------------------------------------
  { id: 'rotate', name: 'Rotate PDF', category: 'Edit', icon: 'rotate',
    blurb: 'Rotate one or every page at once. Save the result in seconds.',
    status: 'ready', path: '/rotate' },
  { id: 'page-numbers', name: 'Add page numbers', category: 'Edit', icon: 'hash',
    blurb: 'Insert page numbers into your PDF, positioned exactly where you like.',
    status: 'ready', path: '/page-numbers' },
  { id: 'watermark', name: 'Watermark', category: 'Edit', icon: 'watermark',
    blurb: 'Stamp an image or text over your PDF in seconds.',
    status: 'ready', path: '/watermark' },
  { id: 'crop', name: 'Crop PDF', category: 'Edit', icon: 'crop',
    blurb: 'Adjust the page margins of a PDF, or a chosen set of pages.',
    status: 'ready', path: '/crop' },
  { id: 'edit', name: 'Edit PDF', category: 'Edit', icon: 'edit',
    blurb: 'Add text, shapes, images and annotations directly onto a PDF.',
    status: 'soon' },
  { id: 'pdf-forms', name: 'PDF Forms', category: 'Edit', icon: 'form',
    blurb: 'Fill out a PDF form, or turn a document into a fillable one.',
    status: 'soon' },

  // ---- Security ---------------------------------------------------------
  { id: 'protect', name: 'Protect PDF', category: 'Security', icon: 'lock',
    blurb: 'Set a password to keep unwanted eyes out of your PDF.',
    status: 'soon' },
  { id: 'unlock', name: 'Unlock PDF', category: 'Security', icon: 'unlock',
    blurb: 'Remove PDF password security when you have permission to do so.',
    status: 'soon' },
  { id: 'sign', name: 'Sign PDF', category: 'Security', icon: 'sign',
    blurb: 'Sign a PDF yourself, or request signatures from others.',
    status: 'soon' },
  { id: 'redact', name: 'Redact PDF', category: 'Security', icon: 'redact',
    blurb: 'Permanently black out sensitive text and images in a PDF.',
    status: 'soon' },
  { id: 'compare', name: 'Compare PDF', category: 'Security', icon: 'compare',
    blurb: 'Spot every change between two versions of a document, side by side.',
    status: 'soon' },

  // ---- PDF Intelligence ---------------------------------------------------
  { id: 'summarize', name: 'AI Summarizer', category: 'PDF Intelligence', icon: 'sparkle',
    blurb: 'Get a quick AI-generated summary of a long PDF document.',
    status: 'soon' },
  { id: 'translate', name: 'Translate PDF', category: 'PDF Intelligence', icon: 'sparkle',
    blurb: 'Translate a PDF into another language while keeping its layout.',
    status: 'soon' },
  { id: 'pdf-to-markdown', name: 'PDF to Markdown', category: 'PDF Intelligence', icon: 'sparkle',
    blurb: 'Convert a PDF into clean Markdown, ready for docs or a wiki.',
    status: 'soon' },
];

export const toolById = (id) => TOOLS.find((t) => t.id === id);
