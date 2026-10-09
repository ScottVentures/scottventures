// routes/subscribe.js — newsletter email capture
const express = require('express');
const db = require('../db');

const router = express.Router();

// Simple, deliberately permissive email check — good enough to catch
// typos and junk without rejecting valid addresses with unusual formats.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/subscribe
// Body: { email: string, _honey?: string }
router.post('/', (req, res) => {
  const { email, _honey } = req.body || {};

  // Honeypot — real visitors never fill this in
  if (_honey) {
    return res.status(200).json({ ok: true }); // pretend success, do nothing
  }

  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    db.prepare('INSERT INTO subscribers (email) VALUES (?)').run(cleanEmail);
    return res.status(201).json({ ok: true, message: 'Subscribed!' });
  } catch (err) {
    // UNIQUE constraint failure means this email already subscribed —
    // treat that as a success from the visitor's point of view rather
    // than an error, since the end state (they're on the list) is the
    // same either way.
    if (err && err.message && err.message.includes('UNIQUE')) {
      return res.status(200).json({ ok: true, message: "You're already subscribed!" });
    }
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;