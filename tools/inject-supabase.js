// Adds the Supabase script tags (vendor lib, config, adapter) to every page that talks to /api.
// Idempotent. Run: node tools/inject-supabase.js
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', 'Backend', 'PDFTools', 'scottpdf-src', 'scottimg-src', '.git', 'tools', 'supabase', 'uploads']);
const NEEDS = /(session|articles|forum|contact|account|auth)\.js|\/api\/(auth|reactions|comments|forum|notifications|messages|contact|subscribe|admin)\b/;
let changed = 0, scanned = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name)); continue; }
    if (!e.name.endsWith('.html')) continue;
    const f = path.join(dir, e.name);
    let html = fs.readFileSync(f, 'utf8');
    scanned++;
    if (!NEEDS.test(html) || html.includes('supabase-adapter.js')) continue;
    const rel = path.relative(path.dirname(f), root).split(path.sep).join('/');
    const p = rel ? rel + '/' : '';
    const tags = '<script src="' + p + 'sources/js/vendor/supabase.js"></script>\n' +
                 '<script src="' + p + 'sources/js/supabase-config.js"></script>\n' +
                 '<script src="' + p + 'sources/js/supabase-adapter.js"></script>\n';
    const i = html.search(/<script\b/i);
    if (i < 0) continue;
    const lineStart = html.lastIndexOf('\n', i) + 1;
    const indent = html.slice(lineStart, i).match(/^\s*/)[0];
    html = html.slice(0, lineStart) + tags.split('\n').filter(Boolean).map(l => indent + l).join('\n') + '\n' + html.slice(lineStart);
    fs.writeFileSync(f, html); changed++;
    console.log('injected', path.relative(root, f));
  }
})(root);
console.log('scanned', scanned, 'changed', changed);
