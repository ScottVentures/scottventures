// routes/auth.js — email + password accounts, sessions, and
// password reset. Uses Node's built-in crypto module for password
// hashing (scrypt + a random salt per user) instead of a third-party
// package like bcrypt, for the same reason db.js uses node:sqlite —
// no native compilation step required.

const fs = require('fs');
const path = require('path');
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');
const config = require('../config');
const { SESSION_TTL_DAYS, RESET_TOKEN_TTL_MINUTES } = config;
const mailer = require('../mailer');

const router = express.Router();

// Profile picture uploads live outside Backend/ (which the static file
// server explicitly blocks) so they're served the same way as any other
// site asset — under siteRoot/uploads/avatars/. Same pattern as the
// message-attachment uploads in routes/messages.js.
const siteRoot = path.resolve(__dirname, '..', '..');
const avatarUploadDir = path.join(siteRoot, 'uploads', 'avatars');
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, avatarUploadDir);
    },
    filename: function (req, file, cb) {
      const randomName = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname || '').slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '') || '.jpg';
      cb(null, randomName + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    if (!AVATAR_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Use a JPG, PNG, GIF, or WEBP image.'));
    }
    cb(null, true);
  }
});

// Deletes a previously-uploaded avatar file from disk. Safe to call
// with null/undefined (nothing to do) or a path that's already gone.
function deleteAvatarFile(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith('/uploads/avatars/')) return;
  const filePath = path.join(siteRoot, avatarUrl.replace(/^\//, ''));
  fs.unlink(filePath, function () { /* best-effort; ignore errors */ });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, expectedHash) {
  const actualHash = hashPassword(password, salt);
  const a = Buffer.from(actualHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt
  );
  return token;
}

function publicUser(user) {
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    avatarUrl: user.avatar_url || null,
    isAdmin: isAdminEmail(user.email),
    notifyLogin: Boolean(user.notify_login),
    notifyReplies: Boolean(user.notify_replies),
    notifyMessages: Boolean(user.notify_messages)
  };
}

// Shared by every route below that needs "who is making this
// request" — looks up the session from the Bearer token and returns
// the user row, or null if there isn't a valid one.
const { getUserFromRequest, isAdminEmail } = require('../auth-helpers');

// POST /api/auth/register
// Body: { firstName, lastName, email, password }
router.post('/register', (req, res) => {
  const { firstName, lastName, email, password } = req.body || {};

  if (
    typeof firstName !== 'string' || !firstName.trim() ||
    typeof lastName !== 'string' || !lastName.trim() ||
    typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim()) ||
    typeof password !== 'string' || password.length < 8 || password.length > 200
  ) {
    return res.status(400).json({ error: 'Fill in every field — password must be at least 8 characters.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);

  const result = db
    .prepare(
      'INSERT INTO users (first_name, last_name, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)'
    )
    .run(firstName.trim(), lastName.trim(), cleanEmail, hash, salt);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = createSession(user.id);

  res.status(201).json({ token, user: publicUser(user) });
});

// POST /api/auth/login
// Body: { email, password }
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Incorrect email or password.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

  // Same generic error whether the email doesn't exist or the
  // password is wrong — don't reveal which one it was.
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const token = createSession(user.id);
  if (user.notify_login) {
    try {
      db.prepare("INSERT INTO notifications (user_id, type, message) VALUES (?, 'login', ?)").run(
        user.id,
        'New login to your account on ' + new Date().toLocaleString()
      );
    } catch (err) {
      console.error('Could not record login notification:', err.message);
    }
  }
  res.json({ token, user: publicUser(user) });
});

// POST /api/auth/logout
// Body: { token }
router.post('/logout', (req, res) => {
  const authHeader = req.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const { token: bodyToken } = req.body || {};
  const token = bearerToken || bodyToken;
  if (typeof token === 'string' && token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ ok: true });
});

// GET /api/auth/me
// Header: Authorization: Bearer <token>
router.get('/me', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in, or session expired.' });
  }
  res.json({ user: publicUser(user) });
});

// PATCH /api/auth/profile
// Header: Authorization: Bearer <token>
// Body: { firstName, lastName, email }
router.patch('/profile', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in, or session expired.' });
  }

  const { firstName, lastName, email } = req.body || {};
  if (
    typeof firstName !== 'string' || !firstName.trim() ||
    typeof lastName !== 'string' || !lastName.trim() ||
    typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())
  ) {
    return res.status(400).json({ error: 'Enter a valid first name, last name, and email.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(cleanEmail, user.id);
  if (existing) {
    return res.status(409).json({ error: 'Another account already uses that email.' });
  }

  db.prepare('UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?').run(
    firstName.trim(),
    lastName.trim(),
    cleanEmail,
    user.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ ok: true, user: publicUser(updated) });
});

// POST /api/auth/avatar
// Header: Authorization: Bearer <token>
// Multipart form field "file". Replaces any existing profile picture —
// the old file (if any) is deleted from disk once the new one is saved.
router.post('/avatar', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in, or session expired.' });
  }

  avatarUpload.single('file')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file received.' });
    }

    const newUrl = '/uploads/avatars/' + req.file.filename;
    const previousUrl = user.avatar_url;

    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(newUrl, user.id);
    deleteAvatarFile(previousUrl);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    res.json({ ok: true, user: publicUser(updated) });
  });
});

// DELETE /api/auth/avatar
// Header: Authorization: Bearer <token>
// Removes the profile picture, falling back to the initial-letter
// avatar everyone starts with.
router.delete('/avatar', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in, or session expired.' });
  }

  deleteAvatarFile(user.avatar_url);
  db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?').run(user.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ ok: true, user: publicUser(updated) });
});

// POST /api/auth/change-password
// Header: Authorization: Bearer <token>
// Body: { currentPassword, newPassword }
// Distinct from /reset-password (which is for someone who's locked
// out and uses an emailed token instead of already being logged in).
router.post('/change-password', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in, or session expired.' });
  }

  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json({ error: 'Enter your current password.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 200) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  if (!verifyPassword(currentPassword, user.password_salt, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(newPassword, salt);
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, user.id);

  // Same as the emailed-reset flow: changing the password signs out
  // every other session so a stolen session token stops working too.
  const authHeader = req.get('Authorization') || '';
  const currentToken = authHeader.slice(7);
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(user.id, currentToken);

  res.json({ ok: true, message: 'Password updated.' });
});


// POST /api/auth/forgot-password
// Body: { email }
// Always returns the same generic response whether or not the email
// is registered — this stops the endpoint being used to check which
// addresses have an account (account enumeration).
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};

  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);

  const genericResponse = {
    ok: true,
    message: "If an account exists for that email, we've sent a reset link to it."
  };

  if (!user) {
    // Don't reveal that the account doesn't exist — just respond as
    // if it went through.
    return res.json(genericResponse);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, user.id, expiresAt);

  // req.protocol + req.get('host') reflects whatever origin the
  // request actually came in on — localhost:4000 in local dev, or
  // the real domain once deployed — since server.js serves the
  // frontend and API from the same origin (see server.js).
  const origin = req.protocol + '://' + req.get('host');
  const resetUrl = origin + '/Account/reset-password.html?token=' + token;

  if (mailer.isConfigured) {
    await mailer.sendMail({
      to: cleanEmail,
      subject: 'Reset your ScottVentures password',
      text:
        'Someone requested a password reset for this account.\n\n' +
        'Reset your password: ' + resetUrl + '\n\n' +
        'This link expires in ' + RESET_TOKEN_TTL_MINUTES + ' minutes. ' +
        "If you didn't request this, you can safely ignore this email."
    });
    // Email sent — don't also hand the link back in the API response,
    // since anyone reading the network response could otherwise use
    // it to reset this account's password themselves.
    return res.json(genericResponse);
  }

  // No email service configured — fall back to returning the link
  // directly so the flow still works end-to-end for local development
  // and testing. See Backend/readme.md for setting up real email.
  return res.json(Object.assign({}, genericResponse, {
    resetUrl: 'reset-password.html?token=' + token,
    devNote: 'Email is not configured, so this link is being returned directly instead of emailed. See Backend/readme.md.'
  }));
});

// POST /api/auth/reset-password
// Body: { token, password }
router.post('/reset-password', (req, res) => {
  const { token, password } = req.body || {};

  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: 'Missing or invalid reset token.' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const reset = db
    .prepare(
      "SELECT * FROM password_resets WHERE token = ? AND consumed_at IS NULL AND julianday(expires_at) > julianday('now')"
    )
    .get(token);

  if (!reset) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);

  db.runInTransaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(
      hash,
      salt,
      reset.user_id
    );
    db.prepare('UPDATE password_resets SET consumed_at = datetime(\'now\') WHERE token = ?').run(
      token
    );
    // Signing out everywhere on a password change is the safer
    // default — if someone else had access to the account, this
    // kicks them out too.
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.user_id);
  });

  res.json({ ok: true, message: 'Password updated — you can log in with your new password.' });
});

// PATCH /api/auth/notification-prefs
// Header: Authorization: Bearer <token>
// Body: { notifyLogin, notifyReplies, notifyMessages } (booleans, all optional)
router.patch('/notification-prefs', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in, or session expired.' });
  }
  const { notifyLogin, notifyReplies, notifyMessages } = req.body || {};
  const nextLogin = typeof notifyLogin === 'boolean' ? (notifyLogin ? 1 : 0) : user.notify_login;
  const nextReplies = typeof notifyReplies === 'boolean' ? (notifyReplies ? 1 : 0) : user.notify_replies;
  const nextMessages = typeof notifyMessages === 'boolean' ? (notifyMessages ? 1 : 0) : user.notify_messages;
  db.prepare('UPDATE users SET notify_login = ?, notify_replies = ?, notify_messages = ? WHERE id = ?').run(
    nextLogin,
    nextReplies,
    nextMessages,
    user.id
  );
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ ok: true, user: publicUser(updated) });
});

// GET /api/auth/sessions
// Header: Authorization: Bearer <token>
// Lists how many devices/browsers are currently signed in, without
// exposing the actual tokens.
router.get('/sessions', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in, or session expired.' });
  }
  const authHeader = req.get('Authorization') || '';
  const currentToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const sessions = db
    .prepare("SELECT token, created_at, expires_at FROM sessions WHERE user_id = ? AND julianday(expires_at) > julianday('now') ORDER BY created_at DESC")
    .all(user.id);
  res.json({
    sessions: sessions.map((s) => ({
      current: s.token === currentToken,
      createdAt: s.created_at,
      expiresAt: s.expires_at
    }))
  });
});

// POST /api/auth/sessions/logout-others
// Header: Authorization: Bearer <token>
// Signs out every session except the one making this request.
router.post('/sessions/logout-others', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in, or session expired.' });
  }
  const authHeader = req.get('Authorization') || '';
  const currentToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const result = db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(user.id, currentToken);
  res.json({ ok: true, signedOutCount: result.changes });
});

// GET /api/auth/export
// Header: Authorization: Bearer <token>
// A simple "download my data" export — the account plus anything
// authored under it (comments, forum posts). Best-effort/self-serve
// privacy tooling, not a formal GDPR export.
router.get('/export', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in, or session expired.' });
  }
  const comments = db
    .prepare('SELECT article_id, message, created_at FROM comments WHERE name = ? ORDER BY created_at DESC')
    .all((user.first_name + ' ' + user.last_name).trim());
  const forumPosts = db
    .prepare('SELECT id, title, body, category, created_at FROM forum_posts WHERE user_id = ? ORDER BY created_at DESC')
    .all(user.id);
  res.json({
    exportedAt: new Date().toISOString(),
    profile: {
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      accountCreatedAt: user.created_at
    },
    comments,
    forumPosts
  });
});

// DELETE /api/auth/account
// Header: Authorization: Bearer <token>
// Body: { password } — the account owner deleting their own account.
// Admin accounts can't self-delete here to avoid locking the site's
// only admins out (an admin can still be removed by another admin
// in Backend/config.js, or by another admin account if more than
// one exists).
router.delete('/account', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in, or session expired.' });
  }
  const { password } = req.body || {};
  if (typeof password !== 'string' || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  if (isAdminEmail(user.email)) {
    return res.status(400).json({ error: "Admin accounts can't be self-deleted here." });
  }

  db.runInTransaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM forum_votes WHERE voter_id = ?').run(String(user.id));
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  });

  res.json({ ok: true });
});

module.exports = router;
