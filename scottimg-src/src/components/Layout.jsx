import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { CATEGORIES, TOOLS } from '../lib/tools';
import './Layout.css';

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="si-header" onMouseLeave={() => setOpen(false)}>
      <nav className="si-nav">
        <Link to="/" className="si-brand">
          <Icon name="image" size={22} />
          <span>Scott<b>Img</b></span>
        </Link>

        <div className="si-quicklinks">
          <Link to="/compress">Compress IMAGE</Link>
          <Link to="/resize">Resize IMAGE</Link>
          <Link to="/crop">Crop IMAGE</Link>

          <div className="si-navdrop" onMouseEnter={() => setOpen(true)}>
            <span className="si-navdrop__trigger">
              All IMAGE tools
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            {open && (
              <div className="si-megamenu">
                {CATEGORIES.map((cat) => (
                  <div key={cat} className="si-megamenu__col">
                    <div className="si-megamenu__title">{cat}</div>
                    {TOOLS.filter((t) => t.category === cat).map((tool) => (
                      <Link
                        key={tool.id}
                        to={tool.status === 'ready' ? tool.path : `/soon/${tool.id}`}
                        className="si-megamenu__link"
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

        <a className="si-header__back" href="../index.html">Back to ScottVentures</a>
      </nav>
    </header>
  );
}

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'All IMAGE tools', href: '/' },
      { label: 'Products', href: '../products.html' },
      { label: 'FAQ', href: '../faq.html' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'ScottPdf Tools', href: '../scottpdf/' },
      { label: 'Articles', href: '../learning-materials.html' },
      { label: 'Tutorials', href: '../tutorials.html' },
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
    <footer className="si-footer">
      <div className="si-footer__grid">
        <div className="si-footer__brand">
          <div className="si-brand">
            <Icon name="image" size={20} />
            <span>Scott<b>Img</b></span>
          </div>
          <p>Every tool you need to edit images in bulk — free, fast, and part of ScottVentures.</p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title} className="si-footer__col">
            <div className="si-footer__title">{col.title}</div>
            {col.links.map((l) => (
              <a key={l.label} href={l.href}>{l.label}</a>
            ))}
          </div>
        ))}
      </div>
      <div className="si-footer__bottom">
        <span>© {new Date().getFullYear()} ScottVentures · ScottImg</span>
      </div>
    </footer>
  );
}

export default function Layout({ children }) {
  return (
    <div className="si-shell">
      <Header />
      <main className="si-main">{children}</main>
      <Footer />
    </div>
  );
}
