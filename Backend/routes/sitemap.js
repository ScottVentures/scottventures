const express = require('express');
const router = express.Router();

// Static pages worth listing. Kept in sync by hand with the real
// pages on the site (see Backend/readme.md for the tradeoff note).
const PAGES = [
  '/', '/about.html', '/products.html', '/tutorials.html',
  '/learning-materials.html', '/contact.html', '/forum.html',
  '/faq.html', '/privacy-policy.html', '/terms.html'
];

router.get('/', (req, res) => {
  const base = req.protocol + '://' + req.get('host');
  const urls = PAGES.map(
    (p) => `  <url><loc>${base}${p}</loc></url>`
  ).join('\n');
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
  );
});

module.exports = router;
