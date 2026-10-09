# ScottVentures on Supabase (static hosting)

The site no longer needs the Express/SQLite server. Pages are static files
(GitHub Pages, Netlify, or your own domain) and the browser talks **directly to
Supabase** for accounts, comments, reactions, the forum, messages,
notifications, the contact form, newsletter sign-ups and file uploads.

`sources/js/supabase-adapter.js` answers the old `/api/...` calls using
supabase-js, so every page works unchanged.

## One-time setup (about 10 minutes)

1. **Create a project** at <https://supabase.com> (free tier is fine).
2. **Create the database**: Dashboard → *SQL Editor* → *New query* → paste the
   whole of [`schema.sql`](schema.sql) → *Run*. (Edit the two admin emails at the
   top first if needed. Safe to re-run.)
3. **Connect the site**: Dashboard → *Project Settings → API*. Copy the
   **Project URL** and the **anon / publishable key** into
   [`../sources/js/supabase-config.js`](../sources/js/supabase-config.js).
   These two values are public by design. **Never** put the `service_role` /
   secret key anywhere in this repository.
4. **Auth settings** (Dashboard → *Authentication*):
   - *URL Configuration → Site URL*: your live address (e.g.
     `https://scott-techstar.github.io`). Under *Redirect URLs* add
     `https://scott-techstar.github.io/**` (and your real domain later, and
     `http://localhost:*/**` for testing). Password-reset and confirmation links
     only work for allowed URLs.
   - *Providers → Email*: leave enabled. **Turn "Confirm email" ON before you
     go public** (recommended — otherwise anyone could register an admin email
     before you do). The admin emails in `admin_emails` become admins the moment
     an account with that email exists, so **register your admin accounts first**.
   - *Emails → SMTP*: Supabase's built-in mailer is heavily rate-limited; add
     your own SMTP provider (Resend, Brevo, Gmail app password…) for real use.
5. **Publish to GitHub Pages**: push the repo, then *Settings → Pages →
   Deploy from branch → main / (root)*. A `.nojekyll` file is included.
6. **Regenerate feed/sitemap** whenever you add pages:
   `SITE_URL=https://your-live-address node tools/build-static.js`

## What lives where

| Feature | Supabase piece |
|---|---|
| Register / login / reset password | Supabase Auth + `profiles` table |
| Profile pictures | Storage bucket `avatars` (public) |
| Article reactions, comments | `article_reactions`, `comments` (+ RPC `react`, `add_comment`) |
| Forum, votes, bookmarks | `forum_posts`, `forum_votes`, `forum_bookmarks` |
| Notifications | `notifications` (created by database triggers) |
| Direct messages + attachments | `direct_messages`, `message_reactions`, bucket `message-attachments` |
| Contact form / inbox | `contact_messages` (admins only can read) |
| Newsletter | `subscribers` (insert-only for visitors) |
| Admin: users, pin posts | RPC `admin_list_users`, `admin_delete_user`, `forum_toggle_pin` |

Row Level Security is enabled on every table, so the public key can only do what
the policies in `schema.sql` allow.

## Known differences from the old Express backend

- **Contact replies** are recorded in the inbox and open in your email app
  (`mailto:`) — a static site can't send mail itself. To send automatically, add
  a Supabase Edge Function that calls your mail provider.
- **Rate limiting**: Supabase Auth has built-in limits; the comment/forum forms
  have no extra throttle. Add Cloudflare in front of your domain if spam appears.
- **Message attachments** use a public bucket with unguessable file names (anyone
  with the exact link can open it).
- **ScottPDF / ScottIMG processing tools** need the Python services in
  `PDFTools/`, which can't run on a static host. The pages and navigation work;
  the tools show a "coming soon" notice. When you deploy those services
  elsewhere (with CORS allowing your site), set `toolsApiBase` in
  `supabase-config.js`.
- Existing data in `Backend/data/site.db` is not migrated (accounts' password
  hashes can't be imported into Supabase Auth). Start fresh, or ask for a
  one-off export script for comments/forum posts.

## Running locally

Any static server works, e.g. `npx serve .` or `python -m http.server`, then open
the printed address. (The old `cd Backend && npm start` server still runs for
offline development and the Python tools, but the site no longer depends on it.)

## Security & anti-bot (recommended before going public)

A static site's anon key is public, so protection has to live in Supabase, not just in the browser.

1. **Rate limits (server-side):** after `schema.sql`, run [`hardening.sql`](hardening.sql) in the SQL Editor. It limits, per visitor/IP:
   contact 3/hour, newsletter 5/hour, comments 8/10 min, forum posts 5/hour, messages 40/10 min, reactions 60/10 min.
2. **CAPTCHA on accounts (free, Cloudflare Turnstile):**
   - Cloudflare dashboard → *Turnstile* → add your site (your GitHub Pages host and later your domain) → copy the **Site key** and **Secret key**.
   - Supabase → *Authentication → Attack Protection* → enable CAPTCHA, provider *Turnstile*, paste the **Secret key**.
   - Paste the **Site key** into `turnstileSiteKey` in `sources/js/supabase-config.js`. The widget then appears on register, login, forgot-password and contact forms.
   - Note: with CAPTCHA on, "change password" and "delete account" ask the user to log in again first.
3. **Also in Supabase → Authentication:** keep *Confirm email* ON, set a minimum password length of 8+, and keep the default auth rate limits.
4. **Browser-side defences** (`sources/js/sv-shield.js`, already on every page): hidden honeypot field, minimum fill-time check, anti-framing (clickjacking), referrer policy.
5. **Never** commit the `service_role` key. Only the Edge Function below uses it (Supabase injects it automatically).

### AI chatbot (optional)

The floating assistant (`sources/js/sv-chat.js`) works out of the box by answering from your articles and pages. To make it a real AI assistant:

```
npm i -g supabase            # or use npx supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy chat --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... ALLOWED_ORIGINS=https://<your-github-pages-host>,https://yourdomain.com
```

The key stays on the server. The function limits each visitor to 20 questions / 10 minutes, caps the site at 500 questions/day (`CHAT_DAILY_CAP`), only accepts requests from `ALLOWED_ORIGINS`, and is instructed to stay on-topic and never invent prices or contact details. If the function isn't deployed or is unreachable, the widget falls back to the built-in assistant automatically. Set `chatbotEnabled: false` in the config to remove the widget.

### What can't be prevented
Anything a browser can read (your public articles) can be scraped. Rate limits and CAPTCHAs stop abuse of forms, accounts and the chatbot, but not someone downloading public pages. If scraping becomes a problem, put the domain behind Cloudflare (free): *Bot Fight Mode*, rate-limiting rules and security headers are one click there, and GitHub Pages cannot set HTTP headers itself.
