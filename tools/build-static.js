// Generates feed.xml, sitemap.xml and robots.txt for static hosting (GitHub Pages etc.).
// The old Express server produced these on the fly; a static site needs real files.
// Usage:  SITE_URL=https://yourdomain.com node tools/build-static.js
//   (for a GitHub project site use e.g. https://username.github.io/repo-name)
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const SITE = (process.env.SITE_URL || process.argv[2] || 'https://scott-techstar.github.io').replace(/\/+$/, '');
const DIRS = ['Articles', 'Tutorials', 'Materials'];
const PAGES = ['', 'about.html', 'products.html', 'tutorials.html', 'learning-materials.html', 'contact.html', 'forum.html',
  'faq.html', 'privacy-policy.html', 'terms.html', 'scottpdf/index.html', 'scottimg/index.html'];
const dec = s => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const items = [];
for (const d of DIRS) {
  for (const f of fs.readdirSync(path.join(root, d))) {
    if (!f.endsWith('.html')) continue;
    const html = fs.readFileSync(path.join(root, d, f), 'utf8');
    const m = re => (re.exec(html) || [])[1] || '';
    let title = dec(m(/<title[^>]*>([^<]*)<\/title>/i)).replace(/\s*[-|]\s*ScottVentures\s*$/i, '').replace(/^ScottVentures\s*[-|]\s*/i, '').trim() || f;
    const desc = dec(m(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)) || title;
    const img = m(/<meta property="og:image" content="([^"]*)"/i).replace(/^\.\.\//, '');
    items.push({ title, desc, href: d + '/' + f, img, mtime: fs.statSync(path.join(root, d, f)).mtime });
  }
}
items.sort((a, b) => b.mtime - a.mtime);
const rss = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>ScottVentures</title>\n  <link>' + SITE + '/</link>\n' +
  '  <description>Short, direct explainers on hardware, coding tricks, and hands-on tutorials.</description>\n' +
  items.map(a => '  <item>\n    <title>' + esc(a.title) + '</title>\n    <link>' + SITE + '/' + a.href + '</link>\n    <guid>' + SITE + '/' + a.href + '</guid>\n' +
    '    <description>' + esc(a.desc) + '</description>\n' + (a.img ? '    <enclosure url="' + SITE + '/' + a.img + '" type="image/webp" length="0"/>\n' : '') +
    '    <pubDate>' + a.mtime.toUTCString() + '</pubDate>\n  </item>').join('\n') + '\n</channel>\n</rss>\n';
const urls = PAGES.map(p => SITE + '/' + p).concat(items.map(a => SITE + '/' + a.href));
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => '  <url><loc>' + esc(u) + '</loc></url>').join('\n') + '\n</urlset>\n';
fs.writeFileSync(path.join(root, 'feed.xml'), rss);
fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(root, 'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /Account/\nSitemap: ' + SITE + '/sitemap.xml\n');
console.log('Wrote feed.xml (' + items.length + ' items), sitemap.xml (' + urls.length + ' urls), robots.txt for ' + SITE);
