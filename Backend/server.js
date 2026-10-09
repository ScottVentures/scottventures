// server.js — entry point for the ScottVentures API
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const reactionsRouter = require('./routes/reactions');
const commentsRouter = require('./routes/comments');
const subscribeRouter = require('./routes/subscribe');
const contactRouter = require('./routes/contact');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const feedRouter = require('./routes/feed');
const forumRouter = require('./routes/forum');
const notificationsRouter = require('./routes/notifications');
const messagesRouter = require('./routes/messages');
const sitemapRouter = require('./routes/sitemap');
const robotsRouter = require('./routes/robots');

const app = express();
const PORT = process.env.PORT || 4000;
const siteRoot = path.resolve(__dirname, '..');

// ---------------------------------------------------------------
// CORS
// ---------------------------------------------------------------
// Production: only these origins are trusted. Replace the
// placeholders with your real domain(s) before deploying live.
const allowedOrigins = [
  'https://scottventures.com',    // <-- replace with your real domain
  'https://www.scottventures.com' // <-- replace with your real domain
];

// Local development: rather than guessing every port a dev server
// might use (Live Server: 5500/5501, Python's http.server: 8000,
// http-server: 8080, Vite: 5173, etc.), any http(s)://localhost:PORT
// or http(s)://127.0.0.1:PORT origin is allowed automatically. This
// is what fixes "it works on my machine's port but not yours" —
// whatever tool you use to preview the site locally will just work.
const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(
  cors({
    origin: function (origin, callback) {
      // No origin at all (Postman, curl, server-to-server) or a page
      // opened directly as file:// (browsers send the literal string
      // "null" as the origin in that case) — allowed for local dev
      // convenience. Remove the `origin === 'null'` check before a
      // real production deploy if that's a concern for your use case.
      if (!origin || origin === 'null' || localOriginPattern.test(origin) || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log('CORS blocked request from origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  })
);

app.use(express.json({ limit: '10kb' }));

// ---------------------------------------------------------------
// Rate limiting — keeps one visitor from hammering the vote/comment
// endpoints. Generous enough for real use, tight enough to blunt
// casual abuse.
// ---------------------------------------------------------------
const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' }
});

// Only throttle state-changing requests (POST) — GET requests just
// read current counts/comments and shouldn't count against the same
// budget, or normal page loads/refreshes trip the limiter.
function limitWritesOnly(limiter) {
  return function (req, res, next) {
    if (req.method === 'POST') {
      return limiter(req, res, next);
    }
    next();
  };
}

app.use('/api/reactions/:articleId', limitWritesOnly(writeLimiter));
app.use('/api/reactions', reactionsRouter);
app.use('/api/comments/:articleId', limitWritesOnly(writeLimiter));
app.use('/api/comments', commentsRouter);
app.use('/api/subscribe', writeLimiter, subscribeRouter);
app.use('/api/contact/:id/reply', writeLimiter);
app.use('/api/contact', limitWritesOnly(writeLimiter));
app.use('/api/contact', contactRouter);

// Auth endpoints get their own, tighter limiter — these are the
// ones worth throttling hardest against brute-force/credential
// stuffing attempts.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — please slow down.' }
});
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/change-password', authLimiter);
app.use('/api/auth/account', authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/admin/users/:id', limitWritesOnly(writeLimiter));
app.use('/api/admin', adminRouter);
app.use('/feed.xml', feedRouter);
app.use('/api/forum/posts/:id/vote', writeLimiter);
app.use('/api/forum/posts', limitWritesOnly(writeLimiter));
app.use('/api/forum', forumRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/messages', limitWritesOnly(writeLimiter));
app.use('/api/messages', messagesRouter);
app.use('/sitemap.xml', sitemapRouter);
app.use('/robots.txt', robotsRouter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// The backend lives inside the site directory. Never expose its source,
// database, or installed packages through the website's static file server.
app.use('/Backend', function (req, res) {
  res.status(404).json({ error: 'Not found' });
});

// ---------------------------------------------------------------
// ScottPDF and ScottIMG each have their own local Python/FastAPI
// service (PDFTools/backend and PDFTools/ScottIMG) instead of a
// Node backend, because they lean on Python libraries (pypdf,
// PyMuPDF, Pillow, etc.) that don't have equivalents worth using
// in Node. Rather than making you start those separately, this
// file launches both automatically whenever the main site starts
// (see "Auto-start the Python services" below) and proxies the
// right paths through to them, so the browser never has to know
// they're different processes. Proxying is implemented with plain
// Node `http` (no new dependency) so it streams file uploads
// straight through without buffering them.
// ---------------------------------------------------------------
const PDF_API_HOST = process.env.SCOTTPDF_API_HOST || '127.0.0.1';
const PDF_API_PORT = process.env.SCOTTPDF_API_PORT || 8000;
const IMG_API_HOST = process.env.SCOTTIMG_API_HOST || '127.0.0.1';
const IMG_API_PORT = process.env.SCOTTIMG_API_PORT || 8001;

// `stripPrefix` lets a service be reachable under its own site path
// (e.g. /scottimg/api/...) while the Python app itself only knows
// about plain /api/... routes — the proxy rewrites the path in
// between so neither side needs to know about the other's layout.
function makeProxy(host, port, { stripPrefix, notRunningMessage } = {}) {
  return function proxy(req, res) {
    const upstreamPath = stripPrefix
      ? req.originalUrl.slice(stripPrefix.length) || '/'
      : req.originalUrl;
    const upstream = http.request(
      {
        host,
        port,
        path: upstreamPath,
        method: req.method,
        headers: req.headers
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
        upstreamRes.pipe(res);
      }
    );
    upstream.on('error', () => {
      if (!res.headersSent) {
        res.status(502).json({ detail: notRunningMessage });
      } else {
        res.end();
      }
    });
    req.pipe(upstream);
  };
}

// ScottPDF's FastAPI app has no prefix of its own (docs_url="/api/docs",
// and its tool endpoint is /api/v1/process/{tool}), so its site-facing
// path already matches what it expects — no rewrite needed.
app.use(
  ['/api/v1', '/api/docs', '/openapi.json'],
  makeProxy(PDF_API_HOST, PDF_API_PORT, {
    notRunningMessage:
      "The PDF tools service isn't ready yet. It should start automatically with the site — check the server console for a Python error, or see PDFTools/README-backend.md."
  })
);

// ScottIMG's FastAPI app only knows about /api/... (it can also run
// fully standalone via run_scottimg.ps1), so when it's reached through
// the main site at /scottimg/api/... that site prefix is stripped
// before forwarding.
app.use(
  '/scottimg/api',
  makeProxy(IMG_API_HOST, IMG_API_PORT, {
    stripPrefix: '/scottimg',
    notRunningMessage:
      "The image tools service isn't ready yet. It should start automatically with the site — check the server console for a Python error, or see PDFTools/ScottIMG/README.md."
  })
);

// ---------------------------------------------------------------
// Auto-start the Python services
// ---------------------------------------------------------------
// ScottPDF and ScottIMG share one Python virtual environment at
// PDFTools/.venv (created the first time you run
// PDFTools/run_scottpdf.ps1 or PDFTools/ScottIMG/run_scottimg.ps1).
// Once that venv exists with its packages installed, running this
// file (`node server.js` / `npm start`) launches both Python
// services as child processes alongside the Node server, so a
// single command brings up the whole site — front and back ends for
// every minisite. If the venv isn't there yet, that one-time setup
// still needs to happen first, so we skip auto-starting and print
// clear instructions instead of failing the whole site.
const pdfToolsDir = path.join(siteRoot, 'PDFTools');
const venvPython = path.join(
  pdfToolsDir,
  '.venv',
  process.platform === 'win32' ? 'Scripts' : 'bin',
  process.platform === 'win32' ? 'python.exe' : 'python'
);

const pythonServices = [];

function startPythonService({ name, cwd, args, port, logPrefix }) {
  const child = spawn(venvPython, args, { cwd, windowsHide: true });
  let restarts = 0;

  child.stdout.on('data', (data) => {
    process.stdout.write(`[${logPrefix}] ${data}`);
  });
  child.stderr.on('data', (data) => {
    process.stderr.write(`[${logPrefix}] ${data}`);
  });
  child.on('exit', (code, signal) => {
    if (child.__stopping) return;
    console.log(`[${logPrefix}] exited (code ${code}, signal ${signal}).`);
    if (restarts < 3) {
      restarts += 1;
      console.log(`[${logPrefix}] restarting in 3s (attempt ${restarts}/3)...`);
      setTimeout(() => startPythonService({ name, cwd, args, port, logPrefix }), 3000);
    } else {
      console.log(`[${logPrefix}] gave up after ${restarts} restarts — fix the error above, then restart the site.`);
    }
  });

  pythonServices.push(child);
  console.log(`[${logPrefix}] starting ${name} on http://127.0.0.1:${port} ...`);
}

if (fs.existsSync(venvPython)) {
  startPythonService({
    name: 'ScottPDF backend',
    cwd: pdfToolsDir,
    args: ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(PDF_API_PORT)],
    port: PDF_API_PORT,
    logPrefix: 'scottpdf'
  });
  startPythonService({
    name: 'ScottIMG backend',
    cwd: path.join(pdfToolsDir, 'ScottIMG'),
    args: ['-m', 'uvicorn', 'app:app', '--app-dir', '.', '--host', '127.0.0.1', '--port', String(IMG_API_PORT)],
    port: IMG_API_PORT,
    logPrefix: 'scottimg'
  });
} else {
  console.log(
    'PDFTools/.venv was not found, so the ScottPDF and ScottIMG backends were not started automatically.\n' +
    'Run PDFTools\\run_scottpdf.ps1 once to create the shared virtual environment and install its packages,\n' +
    'then restart this server — both services will start on their own from then on.'
  );
}

function stopPythonServices() {
  for (const child of pythonServices) {
    child.__stopping = true;
    try {
      child.kill();
    } catch (err) {
      // already gone — nothing to do
    }
  }
}
process.on('SIGINT', () => { stopPythonServices(); process.exit(0); });
process.on('SIGTERM', () => { stopPythonServices(); process.exit(0); });
process.on('exit', stopPythonServices);

// Serve the website and API from one origin in local development. This
// eliminates the fragile "open the HTML file separately, then remember to
// start an API on another port" setup that prevented login and voting from
// working for most visitors. API routes are registered first, so this static
// handler only handles actual website files.
app.use(express.static(siteRoot, {
  index: 'index.html',
  dotfiles: 'ignore'
}));

app.use(function (req, res) {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`ScottVentures is running at http://localhost:${PORT}`);
});
