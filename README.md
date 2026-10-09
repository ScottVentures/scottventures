<div align="center">

# ScottVentures

**Clear tech explainers, hands-on tutorials, learning materials and ICT services.**
Written for curious people, from Mombasa, Kenya.

[![Hosted on GitHub Pages](https://img.shields.io/badge/hosting-GitHub%20Pages-222?logo=github)](https://pages.github.com/)
[![Backend: Supabase](https://img.shields.io/badge/backend-Supabase-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com/)
![Static site](https://img.shields.io/badge/site-static%20HTML%2FCSS%2FJS-d93a35)
![Content](https://img.shields.io/badge/content-81%20pages-3b6fcc)

[Live site](https://scottventures.github.io/scottventures/) &nbsp;·&nbsp; [Setup guide](supabase/README.md) &nbsp;·&nbsp; [Contact](contact.html)

</div>

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [Deploying to GitHub Pages](#deploying-to-github-pages)
- [Moving to a custom domain](#moving-to-a-custom-domain)
- [Configuration](#configuration)
- [Security](#security)
- [Maintenance scripts](#maintenance-scripts)
- [Content guide](#content-guide)
- [Browser support & accessibility](#browser-support--accessibility)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

ScottVentures is a content and services website. It publishes short, direct articles, step-by-step tutorials and organised learning materials, offers ICT services, and gives readers accounts, a forum, comments, reactions and direct messages.

The site is **fully static** — plain HTML, CSS and JavaScript that can be hosted anywhere for free. All dynamic features (accounts, comments, forum, messages, contact form, newsletter, file uploads) talk **directly from the browser to [Supabase](https://supabase.com)**, protected by Postgres Row Level Security.

| | |
|---|---|
| **Content** | 31 articles · 24 tutorials · 26 learning materials, each with its own cover image |
| **Hosting** | GitHub Pages now, custom domain later — no server to maintain |
| **Database & auth** | Supabase (Postgres, Auth, Storage) |
| **Front end** | HTML5, Bootstrap 4, jQuery, vanilla JS |
| **Extras** | Site search, language switcher, dark mode, RSS feed, sitemap, help assistant |

## Features

**For readers**
- Articles, tutorials and learning materials with consistent layouts and unique 1200×630 cover images
- Instant site search and a multi-language switcher
- Accounts with email confirmation, profile photos, notifications and settings
- Article reactions and threaded comments
- Community forum with voting, bookmarks and pinned posts
- Private direct messages with attachments and reactions
- Newsletter sign-up and a validated contact form
- Floating help assistant (optionally AI-powered)
- Light and dark themes, responsive down to phone width

**For the owner**
- Admin tools: manage users, moderate the forum, read and reply to contact messages
- Zero-server hosting and a one-file configuration
- Server-side rate limits and optional CAPTCHA against bots
- Generated `sitemap.xml`, `feed.xml` and `robots.txt`
- Scripts to regenerate covers and re-inject shared scripts across every page

**ScottPDF & ScottIMG** — companion tool suites (merge, split, compress, convert PDFs; resize, crop, convert images). Their pages are included; tools that need a processing server show a friendly *coming soon* notice until one is connected (see [Configuration](#configuration)).

## Architecture

```
 Visitor's browser
 ┌─────────────────────────────────────────────┐        ┌────────────────────────────┐
 │ Static pages (GitHub Pages / any host)      │        │ Supabase                   │
 │  HTML · CSS · jQuery · Bootstrap            │        │  Auth        (accounts)    │
 │                                             │  HTTPS │  Postgres    (RLS-guarded) │
 │ supabase-adapter.js  ── routes /api/* ──────┼───────►│  Storage     (avatars,     │
 │ sv-shield.js         ── bot defences        │        │               attachments) │
 │ sv-chat.js           ── help assistant ─────┼──┐     │  Edge Fn     (chatbot,     │
 └─────────────────────────────────────────────┘  └────►│               optional)    │
                                                        └────────────────────────────┘
```

`sources/js/supabase-adapter.js` intercepts the site's original `/api/...` calls and answers them with `supabase-js`, so every page works without a custom backend. All access control lives in the database (`supabase/schema.sql`), not in the browser — the public anon key is safe to ship.

## Project structure

```
.
├── index.html, about.html, contact.html, faq.html, …   Top-level pages
├── Articles/ Tutorials/ Materials/                     Content pages (+ articles.css / articles.js)
├── Account/                                            Register, login, settings, messages, notifications
├── forum.html, forum-post.html                         Community forum
├── scottpdf/  scottimg/                                Companion tool sites (built output)
├── help/                                               Documentation, security, cookies
├── sources/
│   ├── css/            Site styles
│   ├── images/         Logos, hero and generated cover images (covers/)
│   └── js/             session, search, i18n, adapter, shield, chat, footer, vendor/supabase.js
├── supabase/
│   ├── schema.sql      Tables, RLS policies, triggers, storage buckets
│   ├── hardening.sql   Server-side rate limits
│   ├── functions/chat  Optional AI chatbot (Edge Function)
│   └── README.md       Step-by-step backend setup
├── tools/              Maintenance scripts (see below)
├── Backend/            Legacy Express + SQLite server (kept for local/offline use; not needed on Pages)
└── scottpdf-src/ scottimg-src/ PDFTools/               Sources for the tool suites
```

## Quick start

**Requirements:** a free [Supabase](https://supabase.com) account and a GitHub account. Node.js 22.5+ is only needed for the maintenance scripts.

1. **Clone**
   ```bash
   git clone https://github.com/ScottVentures/scottventures.git
   cd scottventures
   ```
2. **Create the database** — in Supabase open *SQL Editor*, paste and run [`supabase/schema.sql`](supabase/schema.sql), then [`supabase/hardening.sql`](supabase/hardening.sql).
3. **Connect the site** — copy your *Project URL* and *anon / publishable key* (Project Settings → API) into [`sources/js/supabase-config.js`](sources/js/supabase-config.js).
4. **Configure Auth** — set the Site URL and Redirect URLs and keep *Confirm email* on. Details in [`supabase/README.md`](supabase/README.md).
5. **Preview locally**
   ```bash
   npx serve .          # or: python -m http.server 8000
   ```

> The first time you register with an address listed in `admin_emails` (top of `schema.sql`), that account becomes an admin. Register your admin accounts **before** opening the site to the public.

## Deploying to GitHub Pages

1. Push the repository to GitHub (`main` branch).
2. *Settings → Pages* → **Deploy from a branch** → `main` / `(root)`.
3. Wait for the green check; your site is at `https://<user>.github.io/<repo>/`.
4. Add that URL to Supabase *Authentication → URL Configuration* (Site URL and `https://<user>.github.io/<repo>/**` as a redirect).
5. Regenerate the sitemap and feed for the live address:
   ```bash
   SITE_URL=https://scottventures.github.io/scottventures node tools/build-static.js
   ```

A `.nojekyll` file is included so Pages serves the site exactly as committed, and `404.html` provides a branded not-found page.

## Moving to a custom domain

1. Add a `CNAME` file containing your domain (e.g. `www.example.com`) and set the same domain in *Settings → Pages*; create the DNS record your registrar documents for GitHub Pages and enable *Enforce HTTPS*.
2. Add the domain to Supabase *Redirect URLs* and to `ALLOWED_ORIGINS` (chatbot function), and to your Turnstile widget if used.
3. Re-run `tools/build-static.js` with `SITE_URL=https://www.example.com`.

No database migration is needed — the site and its data are already decoupled.

## Configuration

Everything configurable lives in [`sources/js/supabase-config.js`](sources/js/supabase-config.js):

| Setting | Purpose |
|---|---|
| `url`, `anonKey` | Your Supabase project (public values) |
| `toolsApiBase` | Base URL of a deployed PDF/image processing service; empty shows a *coming soon* notice |
| `turnstileSiteKey` | Enables Cloudflare Turnstile CAPTCHA on account and contact forms |
| `chatbotEnabled` | Set `false` to remove the help assistant |

Never put a `service_role` / secret key in this repository.

## Security

- **Row Level Security** on every table; users can only read and write what policies allow
- **Server-side rate limits** for contact, newsletter, comments, forum, messages and reactions (`hardening.sql`)
- **CAPTCHA** (Turnstile) verified by Supabase Auth on sign-up, sign-in and password reset
- **Browser defences:** honeypot, minimum fill time, anti-framing, referrer policy
- **Chatbot hardening:** API key kept server-side, per-visitor and daily caps, origin allow-list, on-topic system prompt
- Email confirmation, avatar/attachment buckets scoped to each user's own folder, HTML-escaped user content

Full checklist and setup steps: [`supabase/README.md`](supabase/README.md#security--anti-bot-recommended-before-going-public). To report a vulnerability, please use the [contact page](contact.html) rather than a public issue.

## Maintenance scripts

Run from the repository root with Node 22+ (Python 3 for the cover tools).

| Script | What it does |
|---|---|
| `node tools/build-static.js` | Rebuilds `sitemap.xml`, `feed.xml`, `robots.txt` (set `SITE_URL`) |
| `node tools/inject-supabase.js` | Adds the Supabase scripts to any page that uses `/api` |
| `node tools/inject-security.js` | Adds the shield and chat scripts to every page |
| `python tools/build-manifest.py` then `python tools/generate-covers.py` | Rebuilds the cover manifest from the content pages, then regenerates the cover images |
| `python tools/wire-covers.py` | Points listing cards and page heroes at their covers |

## Content guide

- **Add an article/tutorial/material:** copy an existing page in `Articles/`, `Tutorials/` or `Materials/`, edit the text, add its entry to `sources/js/search-data.js` and the matching listing page, then run the cover scripts (see above) and `node tools/build-static.js`.
- **House style:** short, direct, useful — 3–6 minute reads, no padded intros, no filler.
- **Images:** one unique cover per piece (1200×630 WebP) with descriptive `alt` text.

## Browser support & accessibility

Current versions of Chrome, Edge, Firefox and Safari, on desktop and mobile. Pages use semantic headings, labelled form fields, visible focus states, `aria-live` status messages and sufficient colour contrast; the layout is responsive from 320 px upward and supports a dark theme.

## Roadmap

- [ ] Deploy the PDF/image processing services and enable the remaining ScottPDF / ScottIMG tools
- [ ] Deploy the AI chatbot Edge Function
- [ ] Custom domain and Cloudflare in front (CDN, bot protection, security headers)
- [ ] Article series, tags and related-content suggestions
- [ ] Newsletter sending workflow

## Contributing

Suggestions and fixes are welcome.

1. Fork the repository and create a branch: `git checkout -b feature/short-description`
2. Keep changes focused; match the existing style and test on desktop and phone widths
3. Commit with a clear message and open a pull request describing what changed and why

Have an article idea or want to write a guest post? Use the [contact page](contact.html).

## License

© ScottVentures. All rights reserved. Content, design and code in this repository may not be copied or redistributed without permission. Third-party libraries (Bootstrap, jQuery, Owl Carousel, supabase-js, Font Awesome) remain under their own licenses.

---

<div align="center">

Made in Mombasa, Kenya &nbsp;·&nbsp; [ScottVentures](https://scottventures.github.io/scottventures/)

</div>
