import { useRef, useState } from 'react';
import Icon from './Icon';
import './PageGrid.css';

// Visual page grid shared by Organize/Rotate/Split/Crop/etc: thumbnails
// that can be selected, reordered by drag, rotated, or deleted, depending
// on which action props a tool passes in (omit a handler to hide that
// control for tools that don't need it — Rotate has no delete button,
// Split has no rotate button, and so on).
export default function PageGrid({
  pages,            // [{ index, dataUrl, rotation, selected }]
  onToggle,
  onReorder,
  onRotate,
  onDelete,
  selectable = true,
}) {
  const dragIndex = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  return (
    <div className="page-grid">
      {pages.map((p, i) => (
        <div
          key={p.index}
          className={`page-card${p.selected ? ' page-card--selected' : ''}${overIndex === i ? ' page-card--over' : ''}`}
          draggable={!!onReorder}
          onDragStart={() => { dragIndex.current = i; }}
          onDragOver={(e) => { e.preventDefault(); setOverIndex(i); }}
          onDragLeave={() => setOverIndex((cur) => (cur === i ? null : cur))}
          onDrop={(e) => {
            e.preventDefault();
            setOverIndex(null);
            if (onReorder && dragIndex.current !== null && dragIndex.current !== i) {
              onReorder(dragIndex.current, i);
            }
            dragIndex.current = null;
          }}
        >
          <button
            type="button"
            className="page-card__thumb"
            onClick={() => selectable && onToggle && onToggle(p.index)}
            aria-label={`Page ${i + 1}`}
          >
            <img
              src={p.dataUrl}
              alt={`Page ${i + 1}`}
              style={{ transform: `rotate(${p.rotation || 0}deg)` }}
            />
            {selectable && (
              <span className={`page-card__check${p.selected ? ' page-card__check--on' : ''}`} />
            )}
          </button>
          <div className="page-card__footer">
            <span className="page-card__num">{i + 1}</span>
            <div className="page-card__actions">
              {onRotate && (
                <button type="button" title="Rotate" onClick={() => onRotate(p.index)}>
                  <Icon name="rotate" size={15} />
                </button>
              )}
              {onDelete && (
                <button type="button" title="Delete" onClick={() => onDelete(p.index)}>
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
