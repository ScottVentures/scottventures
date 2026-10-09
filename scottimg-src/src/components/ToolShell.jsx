import { Link } from 'react-router-dom';
import './ToolShell.css';

export default function ToolShell({ title, description, children }) {
  return (
    <div className="tool-shell">
      <Link to="/" className="tool-shell__crumb">← All tools</Link>
      <div className="tool-shell__head">
        <h1 className="tool-shell__title">{title}</h1>
        {description && <p className="tool-shell__desc">{description}</p>}
      </div>
      <div className="tool-shell__body">{children}</div>
    </div>
  );
}
