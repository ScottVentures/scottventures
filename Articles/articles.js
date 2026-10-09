// -----------------------------------------------------------------
// Articles — reactions & comments, powered by the Backend/ API
// (Express + SQLite). Shared by every page in /Articles/.
//
// CONFIG — update this once you've deployed Backend/ (see
// Backend/readme.md). Until then this points at localhost, so
// reactions/comments simply stay at zero on a live site — the
// rest of the page still works fine.
// -----------------------------------------------------------------
// Prefer the page's own origin when served by Backend/server.js. The fallback
// keeps direct file previews working while the local API is running.
const API_BASE_URL = window.location.protocol === 'http:' || window.location.protocol === 'https:'
  ? window.location.origin
  : 'http://localhost:4000';

document.addEventListener('DOMContentLoaded', function () {
  normalizeReactionIcons();

  var reactionsBar = document.querySelector('[data-reactions]');
  if (reactionsBar) initReactions(reactionsBar);

  var commentsSection = document.querySelector('[data-comments]');
  if (commentsSection) initComments(commentsSection);

  document.querySelectorAll('[data-reactions-mini]').forEach(function (el) {
    var articleId = el.getAttribute('data-reactions-mini');
    var likeEl = el.querySelector('[data-mini-count="like"]');
    var dislikeEl = el.querySelector('[data-mini-count="dislike"]');

    fetch(API_BASE_URL + '/api/reactions/' + encodeURIComponent(articleId))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (likeEl) likeEl.textContent = data.likes;
        if (dislikeEl) dislikeEl.textContent = data.dislikes;
      })
      .catch(function () { /* API not reachable — leave at 0 */ });
  });
});

function reactionIcon(vote) {
  var path = vote === 'like'
    ? 'M7 10v11M2 13v6a2 2 0 0 0 2 2h12.5a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 18 10h-5V5a2 2 0 0 0-2-2L9 10'
    : 'M17 14V3M22 11V5a2 2 0 0 0-2-2H7.5a2 2 0 0 0-2 1.6l-1.4 7A2 2 0 0 0 6 14h5v5a2 2 0 0 0 2 2l2-7';
  return '<svg class="reaction-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"></path></svg>';
}

// The original theme absolutely positions every span in an article card.
// Give every reaction counter the same self-contained SVG markup so its icon
// and number always remain together, regardless of card height or viewport.
function normalizeReactionIcons() {
  document.querySelectorAll('[data-vote]').forEach(function (button) {
    var vote = button.getAttribute('data-vote');
    var count = button.querySelector('[data-count]');
    var value = count ? count.textContent : '0';
    button.setAttribute('aria-label', vote === 'like' ? 'Like this article' : 'Dislike this article');
    button.innerHTML = reactionIcon(vote) + '<span data-count="' + vote + '">' + value + '</span>';
  });

  document.querySelectorAll('[data-reactions-mini]').forEach(function (el) {
    var like = el.querySelector('[data-mini-count="like"]');
    var dislike = el.querySelector('[data-mini-count="dislike"]');
    var likes = like ? like.textContent : '0';
    var dislikes = dislike ? dislike.textContent : '0';
    var isAlreadyInMetaRow = el.parentElement && el.parentElement.classList.contains('card-meta');
    var readMeta = isAlreadyInMetaRow
      ? ''
      : '<span class="article-read-time">2 MIN READ</span><span class="article-meta-separator" aria-hidden="true">·</span><span class="article-published-date">AUG 3</span>';
    el.innerHTML =
      readMeta +
      '<span class="mini-reaction">' + reactionIcon('like') + '<span data-mini-count="like">' + likes + '</span></span>' +
      '<span class="mini-reaction">' + reactionIcon('dislike') + '<span data-mini-count="dislike">' + dislikes + '</span></span>';
  });
}

function getVoterId() {
  var key = 'sv_voter_id';
  var id = localStorage.getItem(key);
  if (!id) {
    id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(key, id);
  }
  return id;
}

function formatCommentDate(isoString) {
  try {
    var date = new Date(isoString.replace(' ', 'T') + 'Z');
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}

function escapeForDisplay(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------- Reactions ---------------- */
function initReactions(bar) {
  var articleId = bar.getAttribute('data-reactions');
  var likeBtn = bar.querySelector('[data-vote="like"]');
  var dislikeBtn = bar.querySelector('[data-vote="dislike"]');
  var likeCount = bar.querySelector('[data-count="like"]');
  var dislikeCount = bar.querySelector('[data-count="dislike"]');
  var voterId = getVoterId();

  // A small status line so a missing/unreachable API is visible
  // instead of the buttons just silently doing nothing when clicked.
  var statusEl = bar.querySelector('[data-reactions-status]');
  if (!statusEl) {
    statusEl = document.createElement('p');
    statusEl.setAttribute('data-reactions-status', '');
    statusEl.className = 'tn-comment-status';
    bar.appendChild(statusEl);
  }

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'tn-comment-status ' + (type || '');
  }

  function render(data) {
    likeCount.textContent = data.likes;
    dislikeCount.textContent = data.dislikes;
    likeBtn.classList.toggle('active', data.yourVote === 'like');
    dislikeBtn.classList.toggle('active', data.yourVote === 'dislike');
    showStatus('', '');
  }

  function load() {
    fetch(API_BASE_URL + '/api/reactions/' + encodeURIComponent(articleId) + '?voterId=' + encodeURIComponent(voterId))
      .then(function (r) { return r.json(); })
      .then(render)
      .catch(function () {
        showStatus("Couldn't reach the server — reactions aren't available right now.", 'error');
      });
  }

  function vote(type) {
    likeBtn.disabled = true;
    dislikeBtn.disabled = true;
    showStatus('', '');
    fetch(API_BASE_URL + '/api/reactions/' + encodeURIComponent(articleId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId: voterId, vote: type })
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok) {
          render(result.data);
        } else {
          showStatus(result.data.error || 'Could not record your vote.', 'error');
        }
      })
      .catch(function () {
        showStatus("Couldn't reach the server — the API may not be deployed/running.", 'error');
      })
      .finally(function () {
        likeBtn.disabled = false;
        dislikeBtn.disabled = false;
      });
  }

  likeBtn.addEventListener('click', function () { vote('like'); });
  dislikeBtn.addEventListener('click', function () { vote('dislike'); });

  load();
}

/* ---------------- Comments ---------------- */
function initComments(section) {
  var articleId = section.getAttribute('data-comments');
  var form = section.querySelector('[data-comment-form]');
  var nameInput = form.querySelector('[name="name"]');
  var messageInput = form.querySelector('[name="message"]');
  var honeyInput = form.querySelector('[name="_honey"]');
  var statusEl = section.querySelector('[data-comment-status]');
  var list = section.querySelector('[data-comment-list]');
  var submitBtn = form.querySelector('button[type="submit"]');

  // If the visitor is logged in, comments/replies use their account
  // name automatically (server-verified — see Backend/routes/comments.js),
  // so the name field isn't needed. Anonymous visitors still just
  // type a name, same as before.
  var token = (typeof svGetToken === 'function') ? svGetToken() : null;
  if (token && nameInput) {
    nameInput.style.display = 'none';
    nameInput.removeAttribute('required');
  }

  function authHeader() {
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  function showStatus(message, type) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = 'tn-comment-status ' + (type || '');
  }

  function renderOne(c, isReply) {
    var ownerBadge = c.is_owner ? '<span class="tn-owner-badge">Admin</span>' : '';
    var replyBtn = isReply ? '' : '<button type="button" class="tn-reply-btn" data-reply-to="' + c.id + '">Reply</button>';
    return (
      '<div class="tn-comment' + (c.is_owner ? ' is-owner' : '') + '" data-comment-id="' + c.id + '">' +
        '<span class="tn-comment-name">' + escapeForDisplay(c.name) + '</span>' + ownerBadge +
        '<span class="tn-comment-date">' + formatCommentDate(c.created_at) + '</span>' +
        '<p class="tn-comment-message">' + escapeForDisplay(c.message) + '</p>' +
        replyBtn +
        (isReply ? '' : '<div class="tn-reply-form-slot" data-reply-slot="' + c.id + '"></div>') +
      '</div>'
    );
  }

  function replyFormHtml(parentId) {
    var namePart = token ? '' :
      '<input type="text" class="tn-reply-name" placeholder="Your name" maxlength="60">';
    return (
      '<div class="tn-reply-form">' +
        namePart +
        '<textarea class="tn-reply-message" placeholder="Write a reply…" maxlength="1000"></textarea>' +
        '<div class="tn-reply-actions">' +
          '<button type="button" class="tn-reply-submit" data-parent-id="' + parentId + '">Post reply</button>' +
          '<button type="button" class="tn-reply-cancel" data-parent-id="' + parentId + '">Cancel</button>' +
        '</div>' +
        '<p class="tn-comment-status" data-reply-status="' + parentId + '"></p>' +
      '</div>'
    );
  }

  function renderComments(comments) {
    if (!comments || !comments.length) {
      list.innerHTML = '<p class="tn-comment-empty">No comments yet — be the first.</p>';
      return;
    }
    // The API returns a flat list; group replies (parent_id set) under
    // their top-level comment so threads render together.
    var topLevel = comments.filter(function (c) { return !c.parent_id; });
    var repliesByParent = {};
    comments.forEach(function (c) {
      if (c.parent_id) {
        (repliesByParent[c.parent_id] = repliesByParent[c.parent_id] || []).push(c);
      }
    });

    list.innerHTML = topLevel.map(function (c) {
      var replies = repliesByParent[c.id] || [];
      var repliesHtml = replies.length
        ? '<div class="tn-comment-replies">' + replies.map(function (r) { return renderOne(r, true); }).join('') + '</div>'
        : '';
      return renderOne(c, false) + repliesHtml;
    }).join('');

    // Wire up Reply buttons after the HTML is in the DOM.
    list.querySelectorAll('.tn-reply-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var parentId = btn.getAttribute('data-reply-to');
        var slot = list.querySelector('[data-reply-slot="' + parentId + '"]');
        if (slot.querySelector('.tn-reply-form')) {
          slot.innerHTML = '';
          return;
        }
        slot.innerHTML = replyFormHtml(parentId);
        wireReplyForm(slot, parentId);
      });
    });
  }

  function wireReplyForm(slot, parentId) {
    var submit = slot.querySelector('.tn-reply-submit');
    var cancel = slot.querySelector('.tn-reply-cancel');
    var nameEl = slot.querySelector('.tn-reply-name');
    var messageEl = slot.querySelector('.tn-reply-message');
    var replyStatus = slot.querySelector('[data-reply-status]');

    cancel.addEventListener('click', function () { slot.innerHTML = ''; });

    submit.addEventListener('click', function () {
      var replyName = nameEl ? nameEl.value.trim() : undefined;
      var replyMessage = messageEl.value.trim();
      if (!replyMessage || (nameEl && !replyName)) {
        replyStatus.textContent = 'Fill in every field.';
        replyStatus.className = 'tn-comment-status error';
        return;
      }
      submit.disabled = true;
      fetch(API_BASE_URL + '/api/comments/' + encodeURIComponent(articleId), {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
        body: JSON.stringify({ name: replyName, message: replyMessage, parent_id: parentId })
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (result) {
          if (result.ok) {
            load();
          } else {
            replyStatus.textContent = result.data.error || 'Something went wrong.';
            replyStatus.className = 'tn-comment-status error';
            submit.disabled = false;
          }
        })
        .catch(function () {
          replyStatus.textContent = "Couldn't reach the server.";
          replyStatus.className = 'tn-comment-status error';
          submit.disabled = false;
        });
    });
  }

  function load() {
    fetch(API_BASE_URL + '/api/comments/' + encodeURIComponent(articleId))
      .then(function (r) { return r.json(); })
      .then(function (data) { renderComments(data.comments); })
      .catch(function () {
        list.innerHTML = '<p class="tn-comment-empty">Comments aren\'t available right now.</p>';
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = nameInput.value.trim();
    var message = messageInput.value.trim();
    if (!message || (!token && !name)) return;

    submitBtn.disabled = true;
    showStatus('', '');

    fetch(API_BASE_URL + '/api/comments/' + encodeURIComponent(articleId), {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
      body: JSON.stringify({ name: name, message: message, _honey: honeyInput.value })
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok) {
          form.reset();
          showStatus('Comment posted.', 'success');
          load();
        } else {
          showStatus(result.data.error || 'Something went wrong.', 'error');
        }
      })
      .catch(function () {
        showStatus("Couldn't reach the server — the API may not be deployed yet.", 'error');
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });

  load();
}
