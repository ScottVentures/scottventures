// routes/forum.js — community discussion posts. Each post's comment
// thread reuses the existing comments table/routes (article_id =
// 'forum-' + post id), so replies and admin badges work identically
// to article comments without duplicating that logic.

const express = require('express');
const db = require('../db');
const { getUserFromRequest, isAdminEmail } = require('../auth-helpers');

const router = express.Router();

const CATEGORIES = ['general', 'help', 'showcase', 'career'];
const SORTS = ['new', 'top', 'hot'];

function commentCount(postId) {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM comments WHERE article_id = ?")
    .get('forum-' + postId);
  return row ? row.n : 0;
}

function voteScore(postId) {
  const row = db
    .prepare(
      "SELECT " +
      "SUM(CASE WHEN vote = 'up' THEN 1 ELSE 0 END) AS ups, " +
      "SUM(CASE WHEN vote = 'down' THEN 1 ELSE 0 END) AS downs " +
      "FROM forum_votes WHERE post_id = ?"
    )
    .get(postId);
  const ups = row.ups || 0;
  const downs = row.downs || 0;
  return { ups, downs, score: ups - downs };
}

// A simple Reddit-style "hot" ranking: net score, decayed by the
// post's age in hours, so a well-liked new post can outrank an old
// one without old top posts ever fully disappearing.
function hotScore(score, createdAt) {
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt.replace(' ', 'T') + 'Z').getTime()) / 3600000);
  return score / Math.pow(ageHours + 2, 1.5);
}

function serializePost(post, voterId, bookmarkedIds) {
  const { ups, downs, score } = voteScore(post.id);
  let yourVote = null;
  if (voterId) {
    const v = db.prepare('SELECT vote FROM forum_votes WHERE post_id = ? AND voter_id = ?').get(post.id, voterId);
    if (v) yourVote = v.vote;
  }
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    category: post.category,
    authorName: post.author_name,
    authorId: post.user_id,
    createdAt: post.created_at,
    pinned: Boolean(post.pinned),
    views: post.views || 0,
    ups, downs, score, yourVote,
    commentCount: commentCount(post.id),
    bookmarked: bookmarkedIds ? bookmarkedIds.has(post.id) : false
  };
}

// GET /api/forum/posts?sort=new|top|hot&category=X&voterId=Y&q=search&bookmarked=1
router.get('/posts', (req, res) => {
  const sort = SORTS.includes(req.query.sort) ? req.query.sort : 'new';
  const category = req.query.category;
  const voterId = req.query.voterId;
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  let posts;
  if (category && CATEGORIES.includes(category)) {
    posts = db.prepare('SELECT * FROM forum_posts WHERE category = ? ORDER BY created_at DESC').all(category);
  } else {
    posts = db.prepare('SELECT * FROM forum_posts ORDER BY created_at DESC').all();
  }

  if (q) {
    posts = posts.filter(function (p) {
      return p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q);
    });
  }

  const loggedInUser = getUserFromRequest(req);
  let bookmarkedIds = null;
  if (loggedInUser) {
    const rows = db.prepare('SELECT post_id FROM forum_bookmarks WHERE user_id = ?').all(loggedInUser.id);
    bookmarkedIds = new Set(rows.map(function (r) { return r.post_id; }));
  }
  if (req.query.bookmarked === '1' && bookmarkedIds) {
    posts = posts.filter(function (p) { return bookmarkedIds.has(p.id); });
  }

  let serialized = posts.map(function (p) { return serializePost(p, voterId, bookmarkedIds); });

  if (sort === 'top') {
    serialized = serialized.sort(function (a, b) { return b.score - a.score; });
  } else if (sort === 'hot') {
    serialized = serialized.sort(function (a, b) {
      return hotScore(b.score, b.createdAt) - hotScore(a.score, a.createdAt);
    });
  }
  // Pinned posts always float to the top, regardless of sort.
  serialized.sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });

  res.json({ posts: serialized, categories: CATEGORIES });
});

// GET /api/forum/posts/:id?voterId=X — also counts as a view.
router.get('/posts/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM forum_posts WHERE id = ?').get(req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }
  db.prepare('UPDATE forum_posts SET views = views + 1 WHERE id = ?').run(post.id);
  post.views += 1;

  const loggedInUser = getUserFromRequest(req);
  let bookmarkedIds = null;
  if (loggedInUser) {
    const row = db.prepare('SELECT 1 FROM forum_bookmarks WHERE user_id = ? AND post_id = ?').get(loggedInUser.id, post.id);
    bookmarkedIds = new Set(row ? [post.id] : []);
  }

  res.json({ post: serializePost(post, req.query.voterId, bookmarkedIds) });
});

// POST /api/forum/posts
// Body: { name?, title, body, category }
// Header: Authorization: Bearer <token> (optional — same pattern as comments)
router.post('/posts', (req, res) => {
  const { name, title, body, category, _honey } = req.body || {};

  if (_honey) return res.status(200).json({ ok: true });

  if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 150) {
    return res.status(400).json({ error: 'Title must be 3-150 characters.' });
  }
  if (typeof body !== 'string' || body.trim().length < 1 || body.trim().length > 5000) {
    return res.status(400).json({ error: 'Post body must be 1-5000 characters.' });
  }
  const cleanCategory = CATEGORIES.includes(category) ? category : 'general';

  const loggedInUser = getUserFromRequest(req);
  let authorName;
  if (loggedInUser) {
    authorName = (loggedInUser.first_name + ' ' + loggedInUser.last_name).trim();
  } else {
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 60) {
      return res.status(400).json({ error: 'Name must be 1-60 characters.' });
    }
    authorName = name.trim();
  }

  const result = db
    .prepare('INSERT INTO forum_posts (title, body, category, author_name, user_id) VALUES (?, ?, ?, ?, ?)')
    .run(title.trim(), body.trim(), cleanCategory, authorName, loggedInUser ? loggedInUser.id : null);

  const post = db.prepare('SELECT * FROM forum_posts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ post: serializePost(post, null, null) });
});

// PATCH /api/forum/posts/:id
// Body: { title?, body?, category? } — the post's own author, or an
// admin, can edit it after the fact (typo fixes, adding detail).
router.patch('/posts/:id', (req, res) => {
  const user = getUserFromRequest(req);
  const post = db.prepare('SELECT * FROM forum_posts WHERE id = ?').get(req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }
  const isOwnerOfPost = user && post.user_id === user.id;
  const isAdmin = user && isAdminEmail(user.email);
  if (!isOwnerOfPost && !isAdmin) {
    return res.status(403).json({ error: 'You can only edit your own posts.' });
  }

  const { title, body, category } = req.body || {};
  const nextTitle = typeof title === 'string' && title.trim().length >= 3 && title.trim().length <= 150
    ? title.trim() : post.title;
  const nextBody = typeof body === 'string' && body.trim().length >= 1 && body.trim().length <= 5000
    ? body.trim() : post.body;
  const nextCategory = CATEGORIES.includes(category) ? category : post.category;

  db.prepare('UPDATE forum_posts SET title = ?, body = ?, category = ? WHERE id = ?')
    .run(nextTitle, nextBody, nextCategory, post.id);

  const updated = db.prepare('SELECT * FROM forum_posts WHERE id = ?').get(post.id);
  res.json({ post: serializePost(updated, req.query.voterId, null) });
});

// POST /api/forum/posts/:id/pin — admin only. Toggles pinned state.
router.post('/posts/:id/pin', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user || !isAdminEmail(user.email)) {
    return res.status(403).json({ error: 'Admin account required.' });
  }
  const post = db.prepare('SELECT * FROM forum_posts WHERE id = ?').get(req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }
  const nextPinned = post.pinned ? 0 : 1;
  db.prepare('UPDATE forum_posts SET pinned = ? WHERE id = ?').run(nextPinned, post.id);
  res.json({ ok: true, pinned: Boolean(nextPinned) });
});

// POST /api/forum/posts/:id/bookmark — logged-in users only. Toggles.
router.post('/posts/:id/bookmark', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Log in to save posts.' });
  }
  const postId = Number(req.params.id);
  const post = db.prepare('SELECT id FROM forum_posts WHERE id = ?').get(postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }
  const existing = db.prepare('SELECT 1 FROM forum_bookmarks WHERE user_id = ? AND post_id = ?').get(user.id, postId);
  if (existing) {
    db.prepare('DELETE FROM forum_bookmarks WHERE user_id = ? AND post_id = ?').run(user.id, postId);
    return res.json({ ok: true, bookmarked: false });
  }
  db.prepare('INSERT INTO forum_bookmarks (user_id, post_id) VALUES (?, ?)').run(user.id, postId);
  res.json({ ok: true, bookmarked: true });
});

// POST /api/forum/posts/:id/vote
// Body: { voterId, vote: 'up' | 'down' } — same toggle pattern as
// article reactions: voting the same way again removes your vote,
// voting the other way switches it.
router.post('/posts/:id/vote', (req, res) => {
  const { voterId, vote } = req.body || {};
  const postId = Number(req.params.id);

  if (!Number.isInteger(postId)) {
    return res.status(400).json({ error: 'Invalid post id.' });
  }
  if (typeof voterId !== 'string' || voterId.length < 8 || voterId.length > 100) {
    return res.status(400).json({ error: 'Invalid voterId.' });
  }
  if (vote !== 'up' && vote !== 'down') {
    return res.status(400).json({ error: "Vote must be 'up' or 'down'." });
  }

  const post = db.prepare('SELECT id FROM forum_posts WHERE id = ?').get(postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }

  const existing = db.prepare('SELECT vote FROM forum_votes WHERE post_id = ? AND voter_id = ?').get(postId, voterId);

  if (existing && existing.vote === vote) {
    db.prepare('DELETE FROM forum_votes WHERE post_id = ? AND voter_id = ?').run(postId, voterId);
  } else if (existing) {
    db.prepare('UPDATE forum_votes SET vote = ? WHERE post_id = ? AND voter_id = ?').run(vote, postId, voterId);
  } else {
    db.prepare('INSERT INTO forum_votes (post_id, voter_id, vote) VALUES (?, ?, ?)').run(postId, voterId, vote);
  }

  const updated = db.prepare('SELECT * FROM forum_posts WHERE id = ?').get(postId);
  res.json({ post: serializePost(updated, voterId, null) });
});

// DELETE /api/forum/posts/:id — admin accounts only, or the post's
// original author if they're logged in.
router.delete('/posts/:id', (req, res) => {
  const user = getUserFromRequest(req);
  const post = db.prepare('SELECT * FROM forum_posts WHERE id = ?').get(req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }
  const isOwnerOfPost = user && post.user_id === user.id;
  const isAdmin = user && isAdminEmail(user.email);
  if (!isOwnerOfPost && !isAdmin) {
    return res.status(403).json({ error: 'You can only delete your own posts.' });
  }

  db.runInTransaction(() => {
    db.prepare('DELETE FROM forum_votes WHERE post_id = ?').run(post.id);
    db.prepare('DELETE FROM forum_bookmarks WHERE post_id = ?').run(post.id);
    db.prepare('DELETE FROM comments WHERE article_id = ?').run('forum-' + post.id);
    db.prepare('DELETE FROM forum_posts WHERE id = ?').run(post.id);
  });

  res.json({ ok: true });
});

module.exports = router;
