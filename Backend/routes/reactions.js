// routes/reactions.js — like/dislike counts per article
const express = require('express');
const db = require('../db');

const router = express.Router();

// A valid article id is a lowercase-slug — keep it tight to avoid
// someone using this endpoint to store arbitrary junk as an "article".
const ARTICLE_ID_PATTERN = /^[a-z0-9-]{1,80}$/;

function isValidArticleId(id) {
  return typeof id === 'string' && ARTICLE_ID_PATTERN.test(id);
}

// GET /api/reactions/:articleId
// Returns { likes, dislikes, yourVote } — yourVote is included only
// if a voterId query param is sent, so the frontend can highlight
// which button this visitor already picked.
router.get('/:articleId', (req, res) => {
  const { articleId } = req.params;
  const { voterId } = req.query;

  if (!isValidArticleId(articleId)) {
    return res.status(400).json({ error: 'Invalid article id' });
  }

  const row = db
    .prepare('SELECT likes, dislikes FROM reactions WHERE article_id = ?')
    .get(articleId);

  const counts = row || { likes: 0, dislikes: 0 };

  let yourVote = null;
  if (voterId) {
    const voteRow = db
      .prepare(
        'SELECT vote_type FROM reaction_votes WHERE article_id = ? AND voter_id = ?'
      )
      .get(articleId, voterId);
    yourVote = voteRow ? voteRow.vote_type : null;
  }

  res.json({ likes: counts.likes, dislikes: counts.dislikes, yourVote });
});

// POST /api/reactions/:articleId
// Body: { voterId: string, vote: 'like' | 'dislike' }
// Casts a new vote, changes an existing vote, or removes it if the
// same vote is sent again (toggle-off behavior).
router.post('/:articleId', (req, res) => {
  const { articleId } = req.params;
  const { voterId, vote } = req.body || {};

  if (!isValidArticleId(articleId)) {
    return res.status(400).json({ error: 'Invalid article id' });
  }
  if (typeof voterId !== 'string' || voterId.length < 8 || voterId.length > 100) {
    return res.status(400).json({ error: 'Invalid voterId' });
  }
  if (vote !== 'like' && vote !== 'dislike') {
    return res.status(400).json({ error: "vote must be 'like' or 'dislike'" });
  }

  const newVoteState = db.runInTransaction(() => {
    db.prepare(
      'INSERT OR IGNORE INTO reactions (article_id, likes, dislikes) VALUES (?, 0, 0)'
    ).run(articleId);

    const existing = db
      .prepare(
        'SELECT vote_type FROM reaction_votes WHERE article_id = ? AND voter_id = ?'
      )
      .get(articleId, voterId);

    if (existing && existing.vote_type === vote) {
      // Same button clicked again — remove the vote (toggle off)
      db.prepare(
        'DELETE FROM reaction_votes WHERE article_id = ? AND voter_id = ?'
      ).run(articleId, voterId);
      db.prepare(
        `UPDATE reactions SET ${vote}s = ${vote}s - 1 WHERE article_id = ?`
      ).run(articleId);
      return null;
    }

    if (existing) {
      // Switching from like -> dislike or vice versa
      db.prepare(
        'UPDATE reaction_votes SET vote_type = ? WHERE article_id = ? AND voter_id = ?'
      ).run(vote, articleId, voterId);
      db.prepare(
        `UPDATE reactions SET ${existing.vote_type}s = ${existing.vote_type}s - 1, ${vote}s = ${vote}s + 1 WHERE article_id = ?`
      ).run(articleId);
    } else {
      // First vote from this visitor
      db.prepare(
        'INSERT INTO reaction_votes (article_id, voter_id, vote_type) VALUES (?, ?, ?)'
      ).run(articleId, voterId, vote);
      db.prepare(
        `UPDATE reactions SET ${vote}s = ${vote}s + 1 WHERE article_id = ?`
      ).run(articleId);
    }

    return vote;
  });

  const counts = db
    .prepare('SELECT likes, dislikes FROM reactions WHERE article_id = ?')
    .get(articleId);

  res.json({ likes: counts.likes, dislikes: counts.dislikes, yourVote: newVoteState });
});

module.exports = router;