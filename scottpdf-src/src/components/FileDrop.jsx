import { useCallback, useRef, useState } from 'react';
import './FileDrop.css';

// PDFTools' own upload control isn't a dashed drop-zone box — it's one
// big red button, with the whole surrounding card acting as a silent
// drop target. Matching that: a prominent pill/rounded button is the
// primary affordance, and dragging a file anywhere onto the card behind
// it still works (with a light highlight while dragging), rather than
// showing a bordered box the button sits awkwardly inside of.
export default function FileDrop({ accept, multiple = false, onFiles, label, hint }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    if (files.length) onFiles(multiple ? files : [files[0]]);
  }, [multiple, onFiles]);

  return (
    <div
      className={`file-drop${dragOver ? ' file-drop--over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <button type="button" className="file-drop__btn" onClick={() => inputRef.current?.click()}>
        <svg width="20" height="20" viewBox="0 0 20 20" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M10 1.8v16.3" />
          <path d="M1.8 10h16.3" />
        </svg>
        <span>{label || 'Select file'}</span>
      </button>
      <div className="file-drop__hint">{hint || 'or drop it here'}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
