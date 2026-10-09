# ScottVentures API

A small Express + SQLite backend that powers five things on the site:

- **Auth** — register, login, logout, and password reset (email + password accounts)
- **Reactions** — like/dislike counts per article
- **Comments** — a comment thread per article
- **Contact form** — validated messages from the Contact page, stored for you to review
- **Subscribers** — newsletter email capture

Everything is stored in a local SQLite file at `data/site.db`, created
automatically the first time you run it. This uses Node's **built-in**
`node:sqlite` module (no third-party database package) — that means
no native compilation step, so it installs cleanly on Windows without
needing Visual Studio Build Tools.

**Requires Node.js 22.5 or newer.** Check your version with `node -v`.

## Running it locally

```bash
cd Backend
npm install
npm start
```

If `npm` is not available on your Windows installation, double-click
`start-server.cmd` in this folder instead; it starts the same server with
Node directly.

The complete website and API will be running at `http://localhost:4000`.
Open that address in your browser rather than opening `index.html` directly.
This is important: it keeps sign-in, registration, likes, dislikes, comments,
and their displayed counters on the same server. A one-line
"SQLite is an experimental feature" warning in the console is
expected and harmless, not an error.

---

## Deploying for real (Render — recommended)

This walks through getting the API live on the internet, not just
your machine. Render's free tier works well here and supports the
persistent disk this app needs.

### 1. Push this folder to GitHub

If you haven't already, create a GitHub repo containing this
`Backend/` folder (either as its own repo, or as a folder inside your
larger `ScottVentures` repo — either works, you'll just point Render
at the right subfolder in step 3).

The `.gitignore` here already excludes `node_modules/` and the actual
database file — but keeps the empty `data/` folder itself tracked via
a `.gitkeep` file, which matters (see the note below).

### 2. Create a Render account

Go to render.com and sign up (free, no card required for the free tier).

### 3. Create a new Web Service

- Click **New +** → **Web Service**
- Connect your GitHub account and select your repo
- If `Backend/` is a subfolder of a bigger repo, set **Root Directory**
  to `Backend`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Instance Type:** Free

### 4. Add a persistent disk — this step is easy to miss and important

Without this, your SQLite database gets wiped every time the service
restarts or redeploys, silently losing every comment, vote, and
subscriber.

- In your new service, go to the **Disks** tab
- Click **Add Disk**
- **Mount Path:** `/opt/render/project/src/data`
- **Size:** 1 GB is overkill for this but it's the minimum

### 5. Deploy

Render will build and start the service automatically. Once it's
live, you'll get a URL like:

```
https://scottventures-api.onrender.com
```

Test it works:

```bash
curl https://scottventures-api.onrender.com/api/health
# -> {"ok":true}
```

**Free tier note:** Render's free web services "spin down" after 15
minutes of no traffic, and take ~30-60 seconds to wake back up on the
next request. For a small personal blog this is usually fine — the
first visitor after a quiet stretch just waits a bit longer for
reactions/comments to load. If that's ever a problem, Render's paid
tier removes this, or Railway/Fly.io have different tradeoffs.

---

## Before you deploy: two things to update

**1. CORS — `server.js`**

Open `server.js` and update the `allowedOrigins` list. Right now it
still has local dev entries (`localhost`, `127.0.0.1`, the `'null'`
origin for file:// testing) and placeholder domains. Once your
frontend has a real URL (from Netlify, GitHub Pages, etc.), replace
the placeholders with it — and remove the `'null'` entry, since
leaving it in means *any* local HTML file on anyone's computer could
call your API.

**2. Frontend — `script.js`**

In your `Frontend/script.js`, find this line near the top:

```js
const API_BASE_URL = 'http://localhost:4000';
```

Change it to your real Render URL:

```js
const API_BASE_URL = 'https://scottventures-api.onrender.com';
```

---

## Replying as the site owner

Comments support one level of threaded replies — anyone can reply to
a top-level comment. If you're logged in with one of the admin
accounts (see `config.ADMIN_EMAILS`, same list used for the contact
inbox and user management), your comments and replies are
automatically tagged with an "Admin" badge and a highlighted
background — no separate key to type, just your normal login.

Note: `OWNER_REPLY_KEY` still exists in `config.js`, but nothing uses
it anymore — comments moved to the same login-based admin check as
everything else. It's harmless to leave as-is.

## Adding a new article

Two places need updating when you add an article — there's no CMS
here, so this is manual:

1. Add the card to `products.html` (and `index.html`'s preview, if
   it should show there).
2. Add an entry to **both** `sources/js/search-data.js` (powers the
   search overlay) and `Backend/routes/feed.js` (powers the RSS
   feed) — same `title`/`desc`/`href` shape in both. They're kept as
   two small duplicated lists rather than one shared file, since one
   runs in the browser and the other in Node, and adding a build step
   just to share a project of this size felt like overkill.

## Endpoints

| Method | Path                          | Purpose                                  |
|--------|-------------------------------|-------------------------------------------|
| POST   | `/api/auth/register`          | Create an account (name, email, password) |
| POST   | `/api/auth/login`             | Log in, returns a session token           |
| POST   | `/api/auth/logout`            | End the current session                   |
| GET    | `/api/auth/me`                | Get the logged-in user for a session token |
| POST   | `/api/auth/forgot-password`   | Request a password-reset link for an email |
| POST   | `/api/auth/reset-password`    | Set a new password using a reset token    |
| GET    | `/api/reactions/:articleId`   | Get like/dislike counts for an article    |
| POST   | `/api/reactions/:articleId`   | Cast, change, or remove a vote            |
| GET    | `/api/comments/:articleId`    | List comments for an article (flat, with `parent_id`) |
| POST   | `/api/comments/:articleId`    | Post a new comment or reply               |
| POST   | `/api/contact`                | Submit the Contact page form              |
| GET    | `/api/contact`                | List contact messages (admin accounts only, via login session) |
| POST   | `/api/contact/:id/reply`      | Email a reply to a contact message (admin accounts only) |
| POST   | `/api/subscribe`              | Add an email to the newsletter list       |
| GET    | `/api/admin/users`            | List all accounts (admin accounts only)   |
| DELETE | `/api/admin/users/:id`        | Delete a user account (admin accounts only) |
| GET    | `/api/health`                 | Check the API is running                  |
| GET    | `/feed.xml`                   | RSS 2.0 feed of all articles              |

`:articleId` matches the article's filename without `.html` — e.g.
for `articles/power-button-explained.html`, the id is
`power-button-explained`.

## Contact form messages, email, and replying

Contact form submissions are stored in `data/site.db` **and** emailed
to you if you've configured SMTP (below). Either way, you can browse
and reply to every message at `http://localhost:4000/contact-inbox.html`
— replies get emailed straight to the person who wrote in.

**Access is based on who's logged in, not a shared key.** The inbox
is only visible to accounts whose email is in `config.ADMIN_EMAILS`
(defaults to `johnniekips@gmail.com` and `scottechstar@gmail.com` —
override with a comma-separated `ADMIN_EMAILS` env var). To use it:

1. Register a normal account at `Account/register.html` using one of
   those exact email addresses.
2. Log in.
3. Visit `contact-inbox.html` — since you're already logged in as an
   admin email, it opens straight to the inbox. No extra password or
   key involved; it's checking your session, the same way the rest
   of the site does.

Anyone logged in with a non-admin email (or not logged in at all)
sees a "log in with an admin account" message instead.

### Setting up email

**Never put real email credentials directly in `config.js` as a
fallback value** — that puts them in your source code, which means
they end up in your Git history forever, even if you delete them
later. Use a `.env` file instead:

1. Copy the template: `cp .env.example .env`
2. Fill in real values in `.env` (not `.env.example`)
3. Run `npm start` as usual — `config.js` loads `.env` automatically

`.env` is already in `.gitignore`, so it never gets committed or
pushed to GitHub. `.env.example` (safe to commit — it has no real
values) shows what's expected:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=you@gmail.com
SMTP_PASS=your16characterapppassword
OWNER_EMAIL=you@gmail.com   # optional — defaults to SMTP_USER
```

For Gmail specifically, `SMTP_PASS` has to be an **App Password** —
a 16-character string Google generates for you, not your normal
account password. Generate one at
https://myaccount.google.com/apppasswords (requires 2-Step
Verification to be turned on for your Google account). Any other
provider (Outlook, Zoho, or a transactional service like
Resend/Postmark) works the same way with their own host/port.

Without `.env` set up, the site still works exactly as before —
messages just save to the database without emailing anyone, and the
inbox page still lets you read and reply to them (replies just won't
be able to send until SMTP is configured — you'll get a clear error
saying so, not a silent failure).

On Render or another host, set these as environment variables in your
service's dashboard instead of using a `.env` file — the effect is
the same, `process.env.SMTP_HOST` etc. gets read either way.

## A note on the password-reset link

`forgot-password` still doesn't send an email — the reset link is
handed back directly in the API response and shown on the page. This
is separate from the contact-form email above; wiring it to actually
email the link (using the same `mailer.js` this project now has) is a
reasonable next step, but isn't done yet. That spot in `routes/auth.js`
is marked with a `TODO`.

## A note on moderation

There's no admin panel. Comments and subscribers go straight into the
database with no review step — fine for a small personal blog, but if
spam becomes a problem, the simplest fix is connecting directly to
the SQLite file (e.g. with the `sqlite3` CLI, or DB Browser for
SQLite) and deleting rows by `id`.
