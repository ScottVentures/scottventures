// Original, hand-drawn line icons (stroke-based, 24x24 viewBox) for
// ScottImg's own tool set. Unknown keys fall back to a plain image glyph.

const PATHS = {
  image: 'M4 5h16v14H4z M4 16l4-4 3 3 5-5 4 4 M8.5 9.5a1.5 1.5 0 1 1 0-.01',
  compress: 'M8 3v5H3 M16 3v5h5 M8 21v-5H3 M16 21v-5h5',
  resize: 'M4 15v5h5 M20 9V4h-5 M4 20l6-6 M20 4l-6 6',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14 M18 22V8a2 2 0 0 0-2-2H2',
  convert: 'M4 8a6 6 0 0 1 10-4.5L16 5 M20 16a6 6 0 0 1-10 4.5L8 19 M12 3.5V7h3.5 M12 20.5V17H8.5',
  editor: 'M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z M14 6l3 3',
  upscale: 'M4 15v5h5 M20 9V4h-5 M4 20l16-16 M14 4h6v6',
  removebg: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M17 14l3 3-3 3 M20 17h-8',
  watermark: 'M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7z M9 12l2 2 4-4',
  meme: 'M4 5h16v14H4z M8 10h.01 M16 10h.01 M8 16c1.2-1.3 6.8-1.3 8 0',
  rotate: 'M17 4v4h-4 M17 8a7 7 0 1 0 2 5',
  htmlimg: 'M4 5h16v14H4z M8.5 9l-1.5 1.5L8.5 12 M11 9l1-3 M12.5 9l1.5 1.5L12.5 12',
  blurface: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 10h.01 M15 10h.01 M8.5 15c1.3-1 5.7-1 7 0',
  doc: 'M6 2h9l5 5v15H6z M15 2v5h5',
};

export default function Icon({ name, size = 24, ...rest }) {
  const d = PATHS[name] || PATHS.image;
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
