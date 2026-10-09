import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { CATEGORIES, TOOLS } from '../lib/tools';
import './Hub.css';

export default function Hub() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter((t) => t.name.toLowerCase().includes(q));
  }, [query]);

  const byCategory = CATEGORIES.map((cat) => ({
    cat,
    tools: filtered.filter((t) => t.category === cat),
  })).filter((g) => g.tools.length);

  return (
    <div className="hub">
      <section className="hub__hero">
        <h1>Every tool you could want to edit images in bulk</h1>
        <p>Your online photo editor is here and forever free! Resize, crop, compress, convert and watermark images in seconds.</p>
        <input
          className="hub__search"
          type="search"
          placeholder="Search tools — e.g. “resize” or “compress”"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </section>

      {byCategory.map(({ cat, tools }) => (
        <section key={cat} className="hub__section">
          <h2>{cat}</h2>
          <div className="hub__grid">
            {tools.map((tool) => (
              <ToolTile key={tool.id} tool={tool} />
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <p className="hub__empty">No tools match “{query}”.</p>
      )}
    </div>
  );
}

function ToolTile({ tool }) {
  const soon = tool.status !== 'ready';
  const content = (
    <>
      <div className="tool-tile__icon"><Icon name={tool.icon} size={26} /></div>
      <div className="tool-tile__name">{tool.name}</div>
      <div className="tool-tile__blurb">{tool.blurb}</div>
      {soon && <span className="tool-tile__badge">Coming soon</span>}
    </>
  );
  return soon ? (
    <Link to={`/soon/${tool.id}`} className="tool-tile tool-tile--soon">{content}</Link>
  ) : (
    <Link to={tool.path} className="tool-tile">{content}</Link>
  );
}
