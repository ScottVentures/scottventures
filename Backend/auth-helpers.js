// auth-helpers.js — shared between routes/auth.js and routes/contact.js
// (and anything else that needs "who is this request from" or "is
// this user an admin").

const db = require('./db');
const config = require('./config');

// Looks up the session from the Bearer token and returns the user
// row, or null if there isn't a valid one.
function getUserFromRequest(req) {
  const authHeader = req.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const session = db
    .prepare("SELECT * FROM sessions WHERE token = ? AND julianday(expires_at) > julianday('now')")
    .get(token);
  if (!session) return null;

  return db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) || null;
}

function isAdminEmail(email) {
  if (!email) return false;
  return config.ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

module.exports = { getUserFromRequest, isAdminEmail };
