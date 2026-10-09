// forum.js — forum listing page: load/filter/search/sort posts,
// submit a new post, cast votes, bookmark, pin (admin), and edit.
// The post-detail page (forum-post.html) uses this file too, for
// the vote/bookmark/edit/pin controls on the single post; its
// comment thread is handled separately by Articles/articles.js,
// reused as-is (see the comment in Backend/routes/forum.js for why).

// Same convention as Articles/articles.js and sources/js/session.js.
var FORUM_API_BASE_URL = window.location.protocol === 'http:' || window.location.protocol === 'https:'
  ? window.location.origin
  : 'http://localhost:4000';

function svForumVoterId() {
  var key = 'sv_voter_id';
  var id = localStorage.getItem(key);
  if (!id) {
    id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(key, id);
  }
  return id;
}

function svEscapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function svTimeAgo(isoString) {
  var then = new Date(isoString.replace(' ', 'T') + 'Z');
  var seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  var days = Math.floor(hours / 24);
  if (days < 30) return days + 'd ago';
  return then.toLocaleDateString();
}

function svForumIsAdmin() {
  try {
    var cached = localStorage.getItem('sv_auth_user');
    return cached ? Boolean(JSON.parse(cached).isAdmin) : false;
  } catch (e) {
    return false;
  }
}

function svForumUserId() {
  try {
    var cached = localStorage.getItem('sv_auth_user');
    return cached ? JSON.parse(cached).id : null;
  } catch (e) {
    return null;
  }
}

// ---------------- Forum listing page ----------------
function initForumList(root) {
  var listEl = root.querySelector('[data-forum-list]');
  var sortSelect = root.querySelector('[data-forum-sort]');
  var categorySelect = root.querySelector('[data-forum-category]');
  var searchInput = root.querySelector('[data-forum-search]');
  var bookmarkedOnlyCheckbox = root.querySelector('[data-forum-bookmarked-only]');
  var newPostForm = root.querySelector('[data-forum-new-post]');
  var toggleBtn = root.querySelector('[data-forum-new-post-toggle]');
  var newPostWrap = root.querySelector('[data-forum-new-post-wrap]');

  var token = (typeof svGetToken === 'function') ? svGetToken() : null;
  if (token && newPostForm) {
    var nameInput = newPostForm.querySelector('[name="name"]');
    if (nameInput) {
      nameInput.style.display = 'none';
      nameInput.removeAttribute('required');
    }
  }
  if (bookmarkedOnlyCheckbox && !token) {
    bookmarkedOnlyCheckbox.closest('label').style.display = 'none';
  }

  var isAdmin = svForumIsAdmin();
  var myId = svForumUserId();

  function renderPosts(posts) {
    if (!posts.length) {
      listEl.innerHTML = '<p class="forum-empty">No posts found.</p>';
      return;
    }
    listEl.innerHTML = posts.map(function (p) {
      var voteClass = p.yourVote ? ' voted-' + p.yourVote : '';
      var snippet = p.body.length > 180 ? p.body.slice(0, 180) + '…' : p.body;
      var pinnedBadge = p.pinned ? '<span class="forum-pinned-badge"><i class="fa fa-thumb-tack"></i> Pinned</span>' : '';
      var bookmarkBtn = token
        ? '<button type="button" class="forum-bookmark-btn' + (p.bookmarked ? ' active' : '') + '" data-bookmark-post-id="' + p.id + '" title="Save post"><i class="fa ' + (p.bookmarked ? 'fa-bookmark' : 'fa-bookmark-o') + '"></i></button>'
        : '';
      var pinBtn = isAdmin
        ? '<button type="button" class="forum-pin-btn" data-pin-post-id="' + p.id + '" title="' + (p.pinned ? 'Unpin' : 'Pin') + '"><i class="fa fa-thumb-tack"></i></button>'
        : '';
      return (
        '<div class="forum-post-card' + voteClass + (p.pinned ? ' pinned' : '') + '" data-post-id="' + p.id + '">' +
          '<div class="forum-vote-col">' +
            '<button type="button" class="forum-vote-btn up" data-vote="up" data-post-id="' + p.id + '"><i class="fa fa-caret-up"></i></button>' +
            '<span class="forum-score">' + p.score + '</span>' +
            '<button type="button" class="forum-vote-btn down" data-vote="down" data-post-id="' + p.id + '"><i class="fa fa-caret-down"></i></button>' +
          '</div>' +
          '<div class="forum-post-body">' +
            pinnedBadge +
            '<span class="forum-category-tag">' + svEscapeHtml(p.category) + '</span>' +
            '<a class="forum-post-title" href="forum-post.html?id=' + p.id + '">' + svEscapeHtml(p.title) + '</a>' +
            '<p class="forum-post-snippet">' + svEscapeHtml(snippet) + '</p>' +
            '<div class="forum-post-meta">Posted by ' + svEscapeHtml(p.authorName) + ' · ' + svTimeAgo(p.createdAt) + ' · ' + p.commentCount + ' comment' + (p.commentCount === 1 ? '' : 's') + ' · ' + p.views + ' view' + (p.views === 1 ? '' : 's') + '</div>' +
          '</div>' +
          '<div class="forum-post-actions">' + bookmarkBtn + pinBtn + '</div>' +
        '</div>'
      );
    }).join('');

    listEl.querySelectorAll('.forum-vote-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { castVote(btn.getAttribute('data-post-id'), btn.getAttribute('data-vote')); });
    });
    listEl.querySelectorAll('[data-bookmark-post-id]').forEach(function (btn) {
      btn.addEventListener('click', function () { toggleBookmark(btn.getAttribute('data-bookmark-post-id')); });
    });
    listEl.querySelectorAll('[data-pin-post-id]').forEach(function (btn) {
      btn.addEventListener('click', function () { togglePin(btn.getAttribute('data-pin-post-id')); });
    });
  }

  function load() {
    var sort = sortSelect ? sortSelect.value : 'new';
    var category = categorySelect ? categorySelect.value : '';
    var q = searchInput ? searchInput.value.trim() : '';
    var url = FORUM_API_BASE_URL + '/api/forum/posts?sort=' + sort + '&voterId=' + encodeURIComponent(svForumVoterId());
    if (category) url += '&category=' + encodeURIComponent(category);
    if (q) url += '&q=' + encodeURIComponent(q);
    if (bookmarkedOnlyCheckbox && bookmarkedOnlyCheckbox.checked) url += '&bookmarked=1';

    var headers = token ? { Authorization: 'Bearer ' + token } : {};
    fetch(url, { headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (data) { renderPosts(data.posts); })
      .catch(function () {
        listEl.innerHTML = '<p class="forum-empty">Couldn\'t reach the server — is the backend running?</p>';
      });
  }

  function castVote(postId, vote) {
    fetch(FORUM_API_BASE_URL + '/api/forum/posts/' + postId + '/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId: svForumVoterId(), vote: vote })
    })
      .then(function (r) { return r.json(); })
      .then(function () { load(); })
      .catch(function () {});
  }

  function toggleBookmark(postId) {
    if (!token) return;
    fetch(FORUM_API_BASE_URL + '/api/forum/posts/' + postId + '/bookmark', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(function (r) { return r.json(); })
      .then(function () { load(); })
      .catch(function () {});
  }

  function togglePin(postId) {
    if (!token) return;
    fetch(FORUM_API_BASE_URL + '/api/forum/posts/' + postId + '/pin', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(function (r) { return r.json(); })
      .then(function () { load(); })
      .catch(function () {});
  }

  if (sortSelect) sortSelect.addEventListener('change', load);
  if (categorySelect) categorySelect.addEventListener('change', load);
  if (bookmarkedOnlyCheckbox) bookmarkedOnlyCheckbox.addEventListener('change', load);
  if (searchInput) {
    var searchTimer;
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(load, 300);
    });
  }

  if (toggleBtn && newPostWrap) {
    toggleBtn.addEventListener('click', function () {
      newPostWrap.classList.toggle('open');
    });
  }

  if (newPostForm) {
    newPostForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var statusEl = root.querySelector('[data-forum-new-post-status]');
      var name = newPostForm.querySelector('[name="name"]');
      var title = newPostForm.querySelector('[name="title"]').value.trim();
      var body = newPostForm.querySelector('[name="body"]').value.trim();
      var category = newPostForm.querySelector('[name="category"]').value;

      if (!title || !body || (!token && (!name || !name.value.trim()))) {
        statusEl.textContent = 'Fill in every field.';
        statusEl.className = 'tn-comment-status error';
        return;
      }

      fetch(FORUM_API_BASE_URL + '/api/forum/posts', {
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}
        ),
        body: JSON.stringify({
          name: name ? name.value.trim() : undefined,
          title: title,
          body: body,
          category: category
        })
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (result) {
          if (result.ok) {
            newPostForm.reset();
            newPostWrap.classList.remove('open');
            statusEl.textContent = '';
            load();
          } else {
            statusEl.textContent = result.data.error || 'Could not create post.';
            statusEl.className = 'tn-comment-status error';
          }
        })
        .catch(function () {
          statusEl.textContent = "Couldn't reach the server.";
          statusEl.className = 'tn-comment-status error';
        });
    });
  }

  load();
}

// ---------------- Forum post detail page ----------------
function initForumPost(root) {
  var params = new URLSearchParams(window.location.search);
  var postId = params.get('id');
  var container = root.querySelector('[data-forum-post-detail]');
  if (!postId || !container) {
    if (container) container.innerHTML = '<p class="forum-empty">Post not found.</p>';
    return;
  }

  var token = (typeof svGetToken === 'function') ? svGetToken() : null;
  var isAdmin = svForumIsAdmin();
  var myId = svForumUserId();
  var editing = false;

  function render(p) {
    document.title = p.title + ' - ScottVentures Forum';
    var voteClass = p.yourVote ? ' voted-' + p.yourVote : '';
    var canEdit = token && (isAdmin || (p.authorId && myId === p.authorId));
    var pinnedBadge = p.pinned ? '<span class="forum-pinned-badge"><i class="fa fa-thumb-tack"></i> Pinned</span>' : '';
    var bookmarkBtn = token
      ? '<button type="button" class="forum-bookmark-btn' + (p.bookmarked ? ' active' : '') + '" id="bookmarkBtn"><i class="fa ' + (p.bookmarked ? 'fa-bookmark' : 'fa-bookmark-o') + '"></i> ' + (p.bookmarked ? 'Saved' : 'Save') + '</button>'
      : '';
    var pinBtn = isAdmin ? '<button type="button" class="forum-bookmark-btn" id="pinBtn"><i class="fa fa-thumb-tack"></i> ' + (p.pinned ? 'Unpin' : 'Pin') + '</button>' : '';
    var editBtn = canEdit ? '<button type="button" class="forum-bookmark-btn" id="editPostBtn"><i class="fa fa-pencil"></i> Edit</button>' : '';

    if (editing) {
      container.innerHTML =
        '<div class="forum-post-card forum-post-detail-card">' +
          '<div class="forum-post-body" style="width:100%;">' +
            '<div class="form-outline mb-3"><input type="text" class="form-control" id="editTitleInput" value="' + svEscapeHtml(p.title) + '"></div>' +
            '<textarea class="form-control mb-3" id="editBodyInput" rows="6">' + p.body + '</textarea>' +
            '<button type="button" class="filled-button" id="saveEditBtn">Save</button> ' +
            '<button type="button" class="filled-button" id="cancelEditBtn" style="background:#6c757d;">Cancel</button>' +
            '<p id="editStatus" class="tn-comment-status"></p>' +
          '</div>' +
        '</div>';
      document.getElementById('saveEditBtn').addEventListener('click', function () {
        var statusEl = document.getElementById('editStatus');
        fetch(FORUM_API_BASE_URL + '/api/forum/posts/' + postId, {
          method: 'PATCH',
          headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
          body: JSON.stringify({
            title: document.getElementById('editTitleInput').value,
            body: document.getElementById('editBodyInput').value
          })
        })
          .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
          .then(function (result) {
            if (result.ok) {
              editing = false;
              render(result.data.post);
            } else {
              statusEl.textContent = result.data.error || 'Could not save.';
              statusEl.className = 'tn-comment-status error';
            }
          });
      });
      document.getElementById('cancelEditBtn').addEventListener('click', function () {
        editing = false;
        render(p);
      });
      return;
    }

    container.innerHTML =
      '<div class="forum-post-card forum-post-detail-card' + voteClass + '">' +
        '<div class="forum-vote-col">' +
          '<button type="button" class="forum-vote-btn up" data-vote="up"><i class="fa fa-caret-up"></i></button>' +
          '<span class="forum-score">' + p.score + '</span>' +
          '<button type="button" class="forum-vote-btn down" data-vote="down"><i class="fa fa-caret-down"></i></button>' +
        '</div>' +
        '<div class="forum-post-body">' +
          pinnedBadge +
          '<span class="forum-category-tag">' + svEscapeHtml(p.category) + '</span>' +
          '<h2 class="forum-post-title-full">' + svEscapeHtml(p.title) + '</h2>' +
          '<p class="forum-post-full-body">' + svEscapeHtml(p.body) + '</p>' +
          '<div class="forum-post-meta">Posted by ' + svEscapeHtml(p.authorName) + ' · ' + svTimeAgo(p.createdAt) + ' · ' + p.views + ' view' + (p.views === 1 ? '' : 's') + '</div>' +
          '<div class="forum-post-actions" style="margin-top:14px;">' + bookmarkBtn + ' ' + pinBtn + ' ' + editBtn + '</div>' +
        '</div>' +
      '</div>';

    container.querySelectorAll('.forum-vote-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        fetch(FORUM_API_BASE_URL + '/api/forum/posts/' + postId + '/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voterId: svForumVoterId(), vote: btn.getAttribute('data-vote') })
        })
          .then(function (r) { return r.json(); })
          .then(function (data) { render(data.post); })
          .catch(function () {});
      });
    });

    var bookmarkBtnEl = document.getElementById('bookmarkBtn');
    if (bookmarkBtnEl) {
      bookmarkBtnEl.addEventListener('click', function () {
        fetch(FORUM_API_BASE_URL + '/api/forum/posts/' + postId + '/bookmark', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token }
        })
          .then(function (r) { return r.json(); })
          .then(function () { reload(); });
      });
    }
    var pinBtnEl = document.getElementById('pinBtn');
    if (pinBtnEl) {
      pinBtnEl.addEventListener('click', function () {
        fetch(FORUM_API_BASE_URL + '/api/forum/posts/' + postId + '/pin', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token }
        })
          .then(function (r) { return r.json(); })
          .then(function () { reload(); });
      });
    }
    var editBtnEl = document.getElementById('editPostBtn');
    if (editBtnEl) {
      editBtnEl.addEventListener('click', function () {
        editing = true;
        render(p);
      });
    }
  }

  function reload() {
    var headers = token ? { Authorization: 'Bearer ' + token } : {};
    fetch(FORUM_API_BASE_URL + '/api/forum/posts/' + postId + '?voterId=' + encodeURIComponent(svForumVoterId()), { headers: headers })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok) {
          render(result.data.post);
        } else {
          container.innerHTML = '<p class="forum-empty">' + (result.data.error || 'Post not found.') + '</p>';
        }
      })
      .catch(function () {
        container.innerHTML = '<p class="forum-empty">Couldn\'t reach the server.</p>';
      });
  }

  reload();
}

document.addEventListener('DOMContentLoaded', function () {
  var listRoot = document.querySelector('[data-forum-list]');
  if (listRoot) initForumList(document);
  var detailRoot = document.querySelector('[data-forum-post-detail]');
  if (detailRoot) initForumPost(document);
});
