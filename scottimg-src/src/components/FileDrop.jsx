import { useCallback, useRef, useState } from 'react';
import './FileDrop.css';

// One big blue button as the primary affordance, with the surrounding
// card also acting as a silent drop target — the same upload pattern
// used across ScottImg's sibling app, ScottPdf.
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
        <span>{label || 'Select image'}</span>
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
