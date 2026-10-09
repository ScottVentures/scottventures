// routes/messages.js — private one-to-one messages between
// registered ScottVentures members (Account/messages.html). Separate
// from Account/notifications.html (activity alerts) and from the
// public forum/comment threads — these are only ever visible to the
// two people in the conversation.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { getUserFromRequest } = require('../auth-helpers');

const router = express.Router();

// Uploaded message attachments live outside Backend/ (which the static
// file server explicitly blocks) so they can be served the same way as
// any other site asset — under siteRoot/uploads/messages/.
const siteRoot = path.resolve(__dirname, '..', '..');
const uploadDir = path.join(siteRoot, 'uploads', 'messages');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip'
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const randomName = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname || '').slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '');
      cb(null, randomName + ext);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: function (req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('That file type is not supported.'));
    }
    cb(null, true);
  }
});

function requireAuth(req, res) {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Not logged in, or session expired.' });
    return null;
  }
  return user;
}

function publicName(user) {
  return (user.first_name + ' ' + user.last_name).trim();
}

// Attaches each message's reactions (as { emoji, userId, fromMe }) so the
// frontend can render reaction pills without a separate round trip per
// message. Cheap enough here since a thread is at most a few hundred rows.
function reactionsForMessages(messageIds, meId) {
  if (!messageIds.length) return {};
  const placeholders = messageIds.map(() => '?').join(',');
  const rows = db
    .prepare('SELECT message_id, user_id, emoji FROM message_reactions WHERE message_id IN (' + placeholders + ')')
    .all(...messageIds);
  const byMessage = {};
  rows.forEach((r) => {
    if (!byMessage[r.message_id]) byMessage[r.message_id] = [];
    byMessage[r.message_id].push({ emoji: r.emoji, userId: r.user_id, fromMe: r.user_id === meId });
  });
  return byMessage;
}

// GET /api/messages/users?q=search
// Lists other registered members to start a new conversation with.
// Only exposes id + name — never email — to anyone logged in.
router.get('/users', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;

  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const all = db.prepare('SELECT id, first_name, last_name FROM users WHERE id != ? ORDER BY first_name').all(me.id);
  const filtered = q
    ? all.filter((u) => (u.first_name + ' ' + u.last_name).toLowerCase().includes(q))
    : all;

  res.json({
    users: filtered.slice(0, 25).map((u) => ({ id: u.id, name: (u.first_name + ' ' + u.last_name).trim() }))
  });
});

// GET /api/messages/conversations
// One row per person the current user has ever exchanged messages
// with, newest last-message first, with an unread count.
router.get('/conversations', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;

  const partnerIds = db
    .prepare(
      'SELECT DISTINCT CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS partner_id ' +
      'FROM direct_messages WHERE sender_id = ? OR recipient_id = ?'
    )
    .all(me.id, me.id, me.id)
    .map((r) => r.partner_id);

  const conversations = partnerIds.map((partnerId) => {
    const partner = db.prepare('SELECT id, first_name, last_name FROM users WHERE id = ?').get(partnerId);
    const last = db
      .prepare(
        'SELECT body, created_at, sender_id FROM direct_messages ' +
        'WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) ' +
        'ORDER BY created_at DESC LIMIT 1'
      )
      .get(me.id, partnerId, partnerId, me.id);
    const unread = db
      .prepare('SELECT COUNT(*) AS n FROM direct_messages WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL')
      .get(partnerId, me.id).n;

    return {
      userId: partnerId,
      name: partner ? (partner.first_name + ' ' + partner.last_name).trim() : 'Deleted user',
      lastMessage: last ? last.body : '',
      lastFromMe: last ? last.sender_id === me.id : false,
      lastAt: last ? last.created_at : null,
      unreadCount: unread
    };
  }).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

  res.json({ conversations });
});

// GET /api/messages/with/:userId
// Full thread with one other member, oldest first. Marks their
// messages to me as read as a side effect of opening the thread.
router.get('/with/:userId', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;

  const otherId = Number(req.params.userId);
  if (!Number.isInteger(otherId)) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }
  const other = db.prepare('SELECT id, first_name, last_name FROM users WHERE id = ?').get(otherId);
  if (!other) {
    return res.status(404).json({ error: 'User not found.' });
  }

  db.prepare(
    "UPDATE direct_messages SET read_at = datetime('now') WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL"
  ).run(otherId, me.id);

  const messages = db
    .prepare(
      'SELECT id, sender_id, body, created_at, read_at, attachment_url, attachment_name, attachment_type ' +
      'FROM direct_messages ' +
      'WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) ' +
      'ORDER BY created_at ASC'
    )
    .all(me.id, otherId, otherId, me.id);

  const reactionsByMessage = reactionsForMessages(messages.map((m) => m.id), me.id);

  res.json({
    otherUser: { id: other.id, name: (other.first_name + ' ' + other.last_name).trim() },
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      fromMe: m.sender_id === me.id,
      read: Boolean(m.read_at),
      attachmentUrl: m.attachment_url || null,
      attachmentName: m.attachment_name || null,
      attachmentType: m.attachment_type || null,
      reactions: reactionsByMessage[m.id] || []
    }))
  });
});

// POST /api/messages/upload
// Multipart form field "file". Returns the saved attachment's URL so the
// client can pass it along in the following POST /api/messages call —
// upload and send are two steps so a failed send doesn't need to re-upload.
router.post('/upload', function (req, res) {
  const me = requireAuth(req, res);
  if (!me) return;

  upload.single('file')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file received.' });
    }
    res.status(201).json({
      attachmentUrl: '/uploads/messages/' + req.file.filename,
      attachmentName: req.file.originalname,
      attachmentType: req.file.mimetype
    });
  });
});

// POST /api/messages
// Body: { recipientId, body, attachmentUrl?, attachmentName?, attachmentType? }
// A message needs text OR an attachment (or both) — not neither.
router.post('/', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;

  const { recipientId, body, attachmentUrl, attachmentName, attachmentType } = req.body || {};
  const cleanRecipientId = Number(recipientId);
  if (!Number.isInteger(cleanRecipientId)) {
    return res.status(400).json({ error: 'Invalid recipient.' });
  }
  if (cleanRecipientId === me.id) {
    return res.status(400).json({ error: "You can't message yourself." });
  }

  const cleanBody = typeof body === 'string' ? body.trim() : '';
  const hasAttachment = typeof attachmentUrl === 'string' && attachmentUrl.startsWith('/uploads/messages/');

  if (!cleanBody && !hasAttachment) {
    return res.status(400).json({ error: 'Message must have text or an attachment.' });
  }
  if (cleanBody.length > 2000) {
    return res.status(400).json({ error: 'Message must be 2000 characters or fewer.' });
  }

  const recipient = db.prepare('SELECT id, notify_messages FROM users WHERE id = ?').get(cleanRecipientId);
  if (!recipient) {
    return res.status(404).json({ error: 'That user no longer exists.' });
  }

  const result = db
    .prepare(
      'INSERT INTO direct_messages (sender_id, recipient_id, body, attachment_url, attachment_name, attachment_type) ' +
      'VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      me.id,
      cleanRecipientId,
      cleanBody,
      hasAttachment ? attachmentUrl : null,
      hasAttachment && typeof attachmentName === 'string' ? attachmentName.slice(0, 200) : null,
      hasAttachment && typeof attachmentType === 'string' ? attachmentType.slice(0, 100) : null
    );

  if (recipient.notify_messages) {
    try {
      db.prepare("INSERT INTO notifications (user_id, type, message, link) VALUES (?, 'message', ?, ?)").run(
        cleanRecipientId,
        publicName(me) + ' sent you a message',
        '../Account/messages.html?with=' + me.id
      );
    } catch (err) {
      console.error('Could not record message notification:', err.message);
    }
  }

  const saved = db.prepare('SELECT * FROM direct_messages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    message: {
      id: saved.id,
      body: saved.body,
      createdAt: saved.created_at,
      fromMe: true,
      read: false,
      attachmentUrl: saved.attachment_url || null,
      attachmentName: saved.attachment_name || null,
      attachmentType: saved.attachment_type || null,
      reactions: []
    }
  });
});

// POST /api/messages/:id/react
// Body: { emoji }
// Toggle pattern: reacting with the same emoji again removes it; a
// different emoji replaces the sender's previous reaction on that message.
// Only the two people in the conversation may react to a message.
router.post('/:id/react', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;

  const messageId = Number(req.params.id);
  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ error: 'Invalid message id.' });
  }
  const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji.trim() : '';
  if (!emoji || emoji.length > 8) {
    return res.status(400).json({ error: 'Invalid reaction.' });
  }

  const message = db.prepare('SELECT id, sender_id, recipient_id FROM direct_messages WHERE id = ?').get(messageId);
  if (!message || (message.sender_id !== me.id && message.recipient_id !== me.id)) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  const existing = db
    .prepare('SELECT emoji FROM message_reactions WHERE message_id = ? AND user_id = ?')
    .get(messageId, me.id);

  if (existing && existing.emoji === emoji) {
    db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?').run(messageId, me.id);
  } else {
    db.prepare(
      'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?) ' +
      'ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = excluded.emoji'
    ).run(messageId, me.id, emoji);
  }

  const reactions = db
    .prepare('SELECT user_id, emoji FROM message_reactions WHERE message_id = ?')
    .all(messageId)
    .map((r) => ({ emoji: r.emoji, userId: r.user_id, fromMe: r.user_id === me.id }));

  res.json({ reactions });
});

module.exports = router;
