// A small set of original, hand-drawn line icons (stroke-based, 24x24
// viewBox) so ScottPdf never has to borrow imagery from anywhere else.
// Unknown keys fall back to a plain document glyph.

const PATHS = {
  merge: 'M4 4h6v7H4zM14 13h6v7h-6z M10 7.5h4a2 2 0 0 1 2 2V13 M10 7.5V6a1 1 0 0 1 1-1',
  split: 'M4 4h16v7H4z M4 13h7v7H4z M14 13h6v7h-6z',
  organize: 'M4 5h6v5H4z M14 5h6v5h-6z M4 14h6v5H4z M14 14h6v5h-6z',
  rotate: 'M17 4v4h-4 M17 8a7 7 0 1 0 2 5',
  compress: 'M8 3v5H3 M16 3v5h5 M8 21v-5H3 M16 21v-5h5',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14 M18 22V8a2 2 0 0 0-2-2H2',
  hash: 'M5 9h14 M5 15h14 M10 4l-2 16 M16 4l-2 16',
  watermark: 'M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7z M9 12l2 2 4-4',
  repair: 'M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4L15 12l-2-2z',
  compare: 'M8 4v16 M16 4v16 M4 9h4 M16 9h4 M4 15h4 M16 15h4',
  image: 'M4 5h16v14H4z M4 16l4-4 3 3 5-5 4 4 M8.5 9.5a1.5 1.5 0 1 1 0-.01',
  word: 'M4 3h11l5 5v13H4z M15 3v5h5 M6.5 13l1.5 6 2-4.5 2 4.5 1.5-6',
  ppt: 'M4 3h11l5 5v13H4z M15 3v5h5 M8 12v6 M8 12h2.5a2 2 0 0 1 0 4H8',
  excel: 'M4 3h11l5 5v13H4z M15 3v5h5 M7 12l5 6 M12 12l-5 6',
  html: 'M4 3h11l5 5v13H4z M15 3v5h5 M7 15l-1.5-1.5L7 12 M12 12l-1 6 M15 12l1.5 1.5L15 15',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3 M20 8V5a1 1 0 0 1-1-1h-3 M4 16v3a1 1 0 0 0 1 1h3 M20 16v3a1 1 0 0 1-1 1h-3 M4 12h16',
  archive: 'M4 4h16v4H4z M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8 M10 12h4',
  edit: 'M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z M14 6l3 3',
  sign: 'M4 19c3-1 4-4 5-7s2-5 4-4 1 4-1 6 6 1 8-2 M4 21h16',
  form: 'M5 4h14v16H5z M8.5 9h2 M8.5 13h2 M8.5 17h2 M13 9h2.5 M13 13h2.5 M13 17h2.5',
  ocr: 'M4 5h16v14H4z M4 9h16 M7 13h2 M7 16h6',
  lock: 'M6 11V8a6 6 0 0 1 12 0v3 M5 11h14v9H5z',
  unlock: 'M6 11V8a6 6 0 0 1 11-3.6 M5 11h14v9H5z',
  redact: 'M4 6h16v4H4z M4 14h10v4H4z',
  sparkle: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6',
  extract: 'M4 4h11l5 5v13H4z M15 4v5h5 M12 12v6 M9 15l3 3 3-3',
  doc: 'M6 2h9l5 5v15H6z M15 2v5h5',
};

export default function Icon({ name, size = 24, ...rest }) {
  const d = PATHS[name] || PATHS.doc;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {d.split(' M').map((seg, i) => (
        <path key={i} d={i === 0 ? seg : 'M' + seg} />
      ))}
    </svg>
  );
}
