// db.js — sets up (or opens) the SQLite database and creates tables
// on first run. Everything the API needs lives in one file: data/site.db
//
// Uses Node's built-in `node:sqlite` module (available in Node 22.5+)
// instead of a third-party package — this avoids native compilation
// entirely, which is what was failing on Windows without Visual
// Studio Build Tools installed.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Ensure the data folder exists — Git doesn't track empty directories,
// so on a fresh deploy (cloned from GitHub) this folder may not exist
// yet even though it's here locally. Without this, opening the
// database would crash on first boot.
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'site.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');

// One row per article, tracking totals
db.exec(`
  CREATE TABLE IF NOT EXISTS reactions (
    article_id TEXT PRIMARY KEY,
    likes INTEGER NOT NULL DEFAULT 0,
    dislikes INTEGER NOT NULL DEFAULT 0
  );
`);

// One row per (article, voter) pair — this is what stops the same
// visitor from voting twice, and lets them change their mind.
// voter_id is a random ID generated client-side and stored in
// localStorage — not a login system, just enough to prevent
// accidental double-clicks and casual re-voting.
db.exec(`
  CREATE TABLE IF NOT EXISTS reaction_votes (
    article_id TEXT NOT NULL,
    voter_id TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('like', 'dislike')),
    PRIMARY KEY (article_id, voter_id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id TEXT NOT NULL,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration: add reply-threading support to comments created before
// this feature existed. ALTER TABLE ADD COLUMN is safe to run even
// if the table already has rows — existing comments just get
// parent_id = NULL (top-level) and is_owner = 0 (normal visitor).
const commentColumns = db.prepare("PRAGMA table_info(comments)").all().map(function (c) { return c.name; });
if (!commentColumns.includes('parent_id')) {
  db.exec('ALTER TABLE comments ADD COLUMN parent_id INTEGER;');
}
if (!commentColumns.includes('is_owner')) {
  db.exec('ALTER TABLE comments ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0;');
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_comments_article
  ON comments (article_id, created_at);
`);

// Newsletter subscribers — one row per email, unique so the same
// address can't sign up twice.
db.exec(`
  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Registered users — email + password accounts.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Contact messages submitted from Contact Us. These are stored locally so a
// submission is real and durable even when no email provider is configured.
db.exec(`
  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    replied_at TEXT,
    reply_body TEXT
  );
`);

// Migration: cover every contact_messages column that might be
// missing on a database created before this column existed —
// including replied_at/reply_body themselves, since some earlier
// versions of this schema didn't have them either. CREATE TABLE IF
// NOT EXISTS above is a no-op on an existing table, so an older
// database only ever gets these via the ALTER TABLE calls here.
const contactColumns = db.prepare("PRAGMA table_info(contact_messages)").all().map(function (c) { return c.name; });
if (!contactColumns.includes('replied_at')) {
  db.exec('ALTER TABLE contact_messages ADD COLUMN replied_at TEXT;');
}
if (!contactColumns.includes('reply_body')) {
  db.exec('ALTER TABLE contact_messages ADD COLUMN reply_body TEXT;');
}
if (!contactColumns.includes('replied_by')) {
  db.exec('ALTER TABLE contact_messages ADD COLUMN replied_by TEXT;');
}

// Migration: per-user notification preferences, so Settings & Privacy
// can offer real toggles (not fake UI) for which activity creates a
// notification. Both default to on so existing behavior is unchanged
// for everyone until they turn one off.
const userColumns = db.prepare("PRAGMA table_info(users)").all().map(function (c) { return c.name; });
if (!userColumns.includes('notify_login')) {
  db.exec('ALTER TABLE users ADD COLUMN notify_login INTEGER NOT NULL DEFAULT 1;');
}
if (!userColumns.includes('notify_replies')) {
  db.exec('ALTER TABLE users ADD COLUMN notify_replies INTEGER NOT NULL DEFAULT 1;');
}
if (!userColumns.includes('notify_messages')) {
  db.exec('ALTER TABLE users ADD COLUMN notify_messages INTEGER NOT NULL DEFAULT 1;');
}

// Migration: profile picture, set via POST /api/auth/avatar. NULL
// means "no picture" — the frontend falls back to an initial-letter
// avatar, same as every account had before this existed.
if (!userColumns.includes('avatar_url')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT;');
}

// Login sessions — one row per active session token. A session is
// looked up by its token on every authenticated request, and deleted
// on logout or on password reset (which signs the account out
// everywhere).
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
`);

// Password-reset tokens — one row per "forgot password" request. A
// token is single-use (consumed_at gets set once it's redeemed) and
// time-limited (expires_at), same pattern as sessions above.
db.exec(`
  CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    consumed_at TEXT
  );
`);

// Forum — community discussion posts, separate from per-article
// comments. Each post's discussion thread reuses the existing
// `comments` table (article_id = 'forum-' + post id), so replies,
// admin badges, and the whole comment UI work identically without
// duplicating that logic.
db.exec(`
  CREATE TABLE IF NOT EXISTS forum_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    author_name TEXT NOT NULL,
    user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS forum_votes (
    post_id INTEGER NOT NULL,
    voter_id TEXT NOT NULL,
    vote TEXT NOT NULL,
    PRIMARY KEY (post_id, voter_id)
  );
`);

// Migration: pin (admin-curated, shown first) and a lightweight view
// counter, added after forum_posts already existed on live sites.
const forumPostColumns = db.prepare("PRAGMA table_info(forum_posts)").all().map(function (c) { return c.name; });
if (!forumPostColumns.includes('pinned')) {
  db.exec('ALTER TABLE forum_posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;');
}
if (!forumPostColumns.includes('views')) {
  db.exec('ALTER TABLE forum_posts ADD COLUMN views INTEGER NOT NULL DEFAULT 0;');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS forum_bookmarks (
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id)
  );
`);

// Direct messages — private one-to-one messages between registered
// members (Account/messages.html). A "conversation" isn't its own
// row/table: it's just every message where the two participants are
// (sender_id, recipient_id) in either order, grouped in the route.
db.exec(`
  CREATE TABLE IF NOT EXISTS direct_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_direct_messages_participants
  ON direct_messages (sender_id, recipient_id, created_at);
`);

// Migration: a message can optionally carry one attachment (image or
// file), uploaded separately via POST /api/messages/upload and
// referenced here by its saved URL.
const dmColumns = db.prepare("PRAGMA table_info(direct_messages)").all().map(function (c) { return c.name; });
if (!dmColumns.includes('attachment_url')) {
  db.exec('ALTER TABLE direct_messages ADD COLUMN attachment_url TEXT;');
}
if (!dmColumns.includes('attachment_name')) {
  db.exec('ALTER TABLE direct_messages ADD COLUMN attachment_name TEXT;');
}
if (!dmColumns.includes('attachment_type')) {
  db.exec('ALTER TABLE direct_messages ADD COLUMN attachment_type TEXT;');
}

// One reaction (emoji) per user per message — reacting again with the
// same emoji removes it, a different emoji swaps it (same toggle
// pattern as article reactions and forum votes elsewhere in this file).
db.exec(`
  CREATE TABLE IF NOT EXISTS message_reactions (
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    PRIMARY KEY (message_id, user_id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// A tiny helper so routes can wrap a set of writes in a transaction
// the same way they would with better-sqlite3's db.transaction() —
// node:sqlite doesn't have that helper built in, so this fills the gap.
db.runInTransaction = function (fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};

module.exports = db;
