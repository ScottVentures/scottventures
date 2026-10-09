// routes/comments.js — comment threads per article, with one level
// of replies (a reply always attaches to a top-level comment).
const express = require('express');
const db = require('../db');
const { getUserFromRequest, isAdminEmail } = require('../auth-helpers');

const router = express.Router();

const ARTICLE_ID_PATTERN = /^[a-z0-9-]{1,80}$/;

function isValidArticleId(id) {
  return typeof id === 'string' && ARTICLE_ID_PATTERN.test(id);
}

// Very small HTML-escaping helper — comments are stored and returned
// as plain text, but this is a second layer of defense in case
// something ever renders them with innerHTML instead of textContent.
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// GET /api/comments/:articleId
// Returns every comment for the article, flat — the frontend groups
// them into threads (top-level comments + their replies) using
// parent_id.
router.get('/:articleId', (req, res) => {
  const { articleId } = req.params;

  if (!isValidArticleId(articleId)) {
    return res.status(400).json({ error: 'Invalid article id' });
  }

  const comments = db
    .prepare(
      'SELECT id, name, message, created_at, parent_id, is_owner FROM comments WHERE article_id = ? ORDER BY created_at ASC'
    )
    .all(articleId);

  res.json({ comments });
});

// POST /api/comments/:articleId
// Body: { name?, message, _honey?, parent_id? }
// Header: Authorization: Bearer <token> (optional)
//
// parent_id — if present, this comment is a reply to that comment id
//             (must belong to the same article, and must itself be a
//             top-level comment — no replies-to-replies).
//
// If a valid logged-in session is provided, the commenter's name is
// taken from their account (so it can't be spoofed), and if that
// account's email is one of config.ADMIN_EMAILS, the comment is
// tagged is_owner=1 and shown with an "Admin" badge. Anonymous
// visitors can still comment without an account — they just type a
// name — same as before.
router.post('/:articleId', (req, res) => {
  const { articleId } = req.params;
  const { name, message, _honey, parent_id } = req.body || {};

  if (!isValidArticleId(articleId)) {
    return res.status(400).json({ error: 'Invalid article id' });
  }

  // Honeypot field — real visitors never fill this in, since it's
  // hidden via CSS. A filled honeypot means a bot filled every field.
  if (_honey) {
    return res.status(200).json({ ok: true }); // pretend success, do nothing
  }

  if (typeof message !== 'string' || message.trim().length < 1 || message.trim().length > 1000) {
    return res.status(400).json({ error: 'Comment must be 1-1000 characters' });
  }

  const loggedInUser = getUserFromRequest(req);
  let isOwner = 0;
  let finalName;

  if (loggedInUser) {
    finalName = (loggedInUser.first_name + ' ' + loggedInUser.last_name).trim();
    isOwner = isAdminEmail(loggedInUser.email) ? 1 : 0;
  } else {
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 60) {
      return res.status(400).json({ error: 'Name must be 1-60 characters' });
    }
    finalName = name.trim();
  }

  let parentId = null;
  if (parent_id !== undefined && parent_id !== null && parent_id !== '') {
    const pid = Number(parent_id);
    if (!Number.isInteger(pid)) {
      return res.status(400).json({ error: 'Invalid parent_id' });
    }
    const parentRow = db
      .prepare('SELECT id, parent_id FROM comments WHERE id = ? AND article_id = ?')
      .get(pid, articleId);
    if (!parentRow) {
      return res.status(400).json({ error: 'Parent comment not found' });
    }
    if (parentRow.parent_id !== null) {
      return res.status(400).json({ error: 'Cannot reply to a reply — only one level of replies is supported' });
    }
    parentId = pid;
  }

  const cleanName = escapeHtml(finalName);
  const cleanMessage = escapeHtml(message.trim());

  const result = db
    .prepare(
      'INSERT INTO comments (article_id, name, message, parent_id, is_owner) VALUES (?, ?, ?, ?, ?)'
    )
    .run(articleId, cleanName, cleanMessage, parentId, isOwner);

  const newComment = db
    .prepare('SELECT id, name, message, created_at, parent_id, is_owner FROM comments WHERE id = ?')
    .get(result.lastInsertRowid);

  if (articleId.startsWith('forum-') && !isOwner) {
    try {
      const postId = articleId.slice('forum-'.length);
      const post = db.prepare('SELECT user_id, title FROM forum_posts WHERE id = ?').get(postId);
      const postAuthor = post && post.user_id
        ? db.prepare('SELECT notify_replies FROM users WHERE id = ?').get(post.user_id)
        : null;
      if (post && post.user_id && postAuthor && postAuthor.notify_replies && !(loggedInUser && loggedInUser.id === post.user_id)) {
        db.prepare(
          "INSERT INTO notifications (user_id, type, message, link) VALUES (?, 'reply', ?, ?)"
        ).run(
          post.user_id,
          cleanName + ' replied to your post "' + post.title + '"',
          '../forum-post.html?id=' + postId
        );
      }
    } catch (err) {
      console.error('Could not record reply notification:', err.message);
    }
  }

  res.status(201).json({ comment: newComment });
});

module.exports = router;