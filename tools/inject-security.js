// Adds sv-shield.js and sv-chat.js right after supabase-adapter.js on every page that has it. Idempotent.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', 'Backend', 'PDFTools', 'scottpdf-src', 'scottimg-src', '.git', 'tools', 'supabase', 'uploads']);
let n = 0;
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(d, e.name)); continue; }
    if (!e.name.endsWith('.html')) continue;
    const f = path.join(d, e.name);
    let h = fs.readFileSync(f, 'utf8');
    if (h.includes('sv-shield.js') || !h.includes('supabase-adapter.js')) continue;
    const m = h.match(/^([ \t]*)<script src="([^"]*)supabase-adapter\.js"><\/script>/m);
    if (!m) continue;
    const add = '\n' + m[1] + '<script src="' + m[2] + 'sv-shield.js"></script>\n' + m[1] + '<script src="' + m[2] + 'sv-chat.js" defer></script>';
    h = h.replace(m[0], m[0] + add);
    fs.writeFileSync(f, h); n++;
  }
})(root);
console.log('updated', n, 'pages');
