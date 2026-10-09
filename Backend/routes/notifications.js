const express = require('express');
const db = require('../db');
const { getUserFromRequest } = require('../auth-helpers');

const router = express.Router();

function requireAuth(req, res) {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Not logged in, or session expired.' });
    return null;
  }
  return user;
}

router.get('/', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const notifications = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(user.id);
  const unreadCount = notifications.filter((n) => !n.read_at).length;
  res.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      link: n.link,
      read: Boolean(n.read_at),
      createdAt: n.created_at
    })),
    unreadCount
  });
});

router.post('/:id/read', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?").run(
    req.params.id,
    user.id
  );
  res.json({ ok: true });
});

router.post('/read-all', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(
    user.id
  );
  res.json({ ok: true });
});

module.exports = router;
