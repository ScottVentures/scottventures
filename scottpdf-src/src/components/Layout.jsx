import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { CATEGORIES, TOOLS } from '../lib/tools';
import './Layout.css';

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sp-header" onMouseLeave={() => setOpen(false)}>
      <nav className="sp-nav">
        <Link to="/" className="sp-brand">
          <Icon name="doc" size={22} />
          <span>Scott<b>Pdf</b></span>
        </Link>

        <div className="sp-quicklinks">
          <Link to="/merge">Merge PDF</Link>
          <Link to="/split">Split PDF</Link>
          <Link to="/compress">Compress PDF</Link>

          <div className="sp-navdrop" onMouseEnter={() => setOpen(true)}>
            <span className="sp-navdrop__trigger">
              All PDF tools
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            {open && (
              <div className="sp-megamenu">
                {CATEGORIES.map((cat) => (
                  <div key={cat} className="sp-megamenu__col">
                    <div className="sp-megamenu__title">{cat}</div>
                    {TOOLS.filter((t) => t.category === cat).map((tool) => (
                      <Link
                        key={tool.id}
                        to={tool.status === 'ready' ? tool.path : `/soon/${tool.id}`}
                        className="sp-megamenu__link"
                        onClick={() => setOpen(false)}
                      >
                        <Icon name={tool.icon} size={16} />
                        {tool.name}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <a className="sp-header__back" href="../index.html">Back to ScottVentures</a>
      </nav>
    </header>
  );
}

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'All PDF tools', href: '/' },
      { label: 'Products', href: '../products.html' },
      { label: 'FAQ', href: '../faq.html' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Articles', href: '../learning-materials.html' },
      { label: 'Tutorials', href: '../tutorials.html' },
      { label: 'Forum', href: '../forum.html' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '../privacy-policy.html' },
      { label: 'Terms', href: '../terms.html' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '../about.html' },
      { label: 'Contact', href: '../contact.html' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="sp-footer">
      <div className="sp-footer__grid">
        <div className="sp-footer__brand">
          <div className="sp-brand">
            <Icon name="doc" size={20} />
            <span>Scott<b>Pdf</b></span>
          </div>
          <p>Every tool you need to work with PDFs — free, fast, and part of ScottVentures.</p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title} className="sp-footer__col">
            <div className="sp-footer__title">{col.title}</div>
            {col.links.map((l) => (
              <a key={l.label} href={l.href}>{l.label}</a>
            ))}
          </div>
        ))}
      </div>
      <div className="sp-footer__bottom">
        <span>© {new Date().getFullYear()} ScottVentures · ScottPdf</span>
      </div>
    </footer>
  );
}

export default function Layout({ children }) {
  return (
    <div className="sp-shell">
      <Header />
      <main className="sp-main">{children}</main>
      <Footer />
    </div>
  );
}
