// routes/admin.js — admin-only endpoints for managing user accounts.
// Access is based on the logged-in account's email being in
// config.ADMIN_EMAILS (see auth-helpers.js) — same rule the contact
// inbox uses, not a separate password.

const express = require('express');
const db = require('../db');
const { getUserFromRequest, isAdminEmail } = require('../auth-helpers');

const router = express.Router();

function requireAdmin(req, res) {
  const user = getUserFromRequest(req);
  if (!user || !isAdminEmail(user.email)) {
    res.status(403).json({ error: 'You need to be logged in with an admin account to do that.' });
    return null;
  }
  return user;
}

// GET /api/admin/users
router.get('/users', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const users = db
    .prepare('SELECT id, first_name, last_name, email, created_at FROM users ORDER BY created_at DESC')
    .all();
  const withRole = users.map(function (u) {
    return {
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      createdAt: u.created_at,
      isAdmin: isAdminEmail(u.email)
    };
  });
  res.json({ users: withRole });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }
  if (targetId === admin.id) {
    return res.status(400).json({ error: "You can't delete your own account from here." });
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) {
    return res.status(404).json({ error: 'User not found.' });
  }

  db.runInTransaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  });

  res.json({ ok: true });
});

module.exports = router;
