const express = require('express');
const db = require('../db');
const config = require('../config');
const mailer = require('../mailer');
const { getUserFromRequest, isAdminEmail } = require('../auth-helpers');

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', async (req, res) => {
  const { name, phone, email, subject, message, _honey } = req.body || {};

  // Quietly accept bot submissions without storing them.
  if (_honey) return res.status(200).json({ ok: true, message: 'Message received.' });

  const fields = [name, phone, email, subject, message];
  if (fields.some(function (field) { return typeof field !== 'string' || !field.trim(); })) {
    return res.status(400).json({ error: 'Please complete every field.' });
  }
  if (!EMAIL_PATTERN.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (name.trim().length > 100 || phone.trim().length > 50 || email.trim().length > 254 || subject.trim().length > 150 || message.trim().length > 5000) {
    return res.status(400).json({ error: 'One or more fields are too long.' });
  }

  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();

  try {
    const inserted = db.prepare(
      'INSERT INTO contact_messages (name, phone, email, subject, message) VALUES (?, ?, ?, ?, ?)'
    ).run(cleanName, cleanPhone, cleanEmail, cleanSubject, cleanMessage);

    // Every admin account also gets it as a real in-site notification
    // (bell icon + Account/notifications.html), not just email — so a
    // message is visible even when the admin's mail client is closed,
    // and both admins see the same inbox item.
    try {
      config.ADMIN_EMAILS.forEach(function (adminEmail) {
        const adminUser = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
        if (adminUser) {
          db.prepare(
            "INSERT INTO notifications (user_id, type, message, link) VALUES (?, 'contact', ?, ?)"
          ).run(
            adminUser.id,
            'New contact message from ' + cleanName + ': "' + cleanSubject + '"',
            '../contact-inbox.html'
          );
        }
      });
    } catch (err) {
      console.error('Could not record contact notification:', err.message);
    }

    // Best-effort notification — a failed/unconfigured email never
    // blocks the person's message from being accepted and stored.
    if (config.OWNER_EMAIL) {
      mailer.sendMail({
        to: config.OWNER_EMAIL,
        replyTo: cleanEmail,
        subject: 'New contact form message: ' + cleanSubject,
        text:
          'From: ' + cleanName + ' <' + cleanEmail + '>\n' +
          'Phone: ' + cleanPhone + '\n\n' +
          cleanMessage + '\n\n' +
          '— Reply directly to this email to respond, or use the site\'s ' +
          'contact inbox if you have it open.'
      }).catch(function () {}); // sendMail already logs its own errors
    }

    return res.status(201).json({ ok: true, message: 'Thanks — your message has been received.' });
  } catch (err) {
    console.error('Contact message error:', err);
    return res.status(500).json({ error: 'Could not send your message. Please try again.' });
  }
});

// A small guard shared by both admin-only routes below: must be
// logged in (a valid session Bearer token) AND that account's email
// must be one of the addresses in config.ADMIN_EMAILS.
function requireAdmin(req, res) {
  const user = getUserFromRequest(req);
  if (!user || !isAdminEmail(user.email)) {
    res.status(403).json({ error: 'You need to be logged in with an admin account to do that.' });
    return null;
  }
  return user;
}

// GET /api/contact
// Header: Authorization: Bearer <token> (must belong to an admin account)
// Lists stored messages, newest first.
router.get('/', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const messages = db
    .prepare('SELECT * FROM contact_messages ORDER BY created_at DESC')
    .all();
  res.json({ messages });
});

// POST /api/contact/:id/reply
// Header: Authorization: Bearer <token> (must belong to an admin account)
// Body: { replyBody }
// Emails the original sender and records that a reply was sent.
router.post('/:id/reply', async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { replyBody } = req.body || {};
  if (typeof replyBody !== 'string' || !replyBody.trim() || replyBody.length > 5000) {
    return res.status(400).json({ error: 'Reply message is required (max 5000 characters).' });
  }

  const original = db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(req.params.id);
  if (!original) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  // Both admin accounts share this one inbox — if the other admin
  // already replied (from the site or is about to, in a near-
  // simultaneous request), don't send a second, possibly
  // conflicting reply. The client shows the existing reply instead.
  if (original.replied_at) {
    return res.status(409).json({
      error: (original.replied_by || 'Another admin') + ' already replied to this message.',
      repliedAt: original.replied_at,
      repliedBy: original.replied_by,
      replyBody: original.reply_body
    });
  }

  const cleanReply = replyBody.trim();

  if (!config.OWNER_EMAIL) {
    return res.status(400).json({
      error: 'Email isn\'t configured on this server yet (see Backend/readme.md), so a reply can\'t be sent from here.'
    });
  }

  const result = await mailer.sendMail({
    to: original.email,
    replyTo: config.OWNER_EMAIL,
    subject: 'Re: ' + original.subject,
    text: cleanReply + '\n\n---\nYour original message:\n' + original.message
  });

  if (!result.sent) {
    return res.status(502).json({ error: 'Could not send the reply email. Check the server log for details.' });
  }

  const adminName = (admin.first_name + ' ' + admin.last_name).trim() || admin.email;
  db.prepare(
    'UPDATE contact_messages SET replied_at = datetime(\'now\'), reply_body = ?, replied_by = ? WHERE id = ?'
  ).run(cleanReply, adminName, req.params.id);

  res.json({ ok: true, repliedBy: adminName });
});

module.exports = router;
