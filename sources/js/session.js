// -----------------------------------------------------------------
// sources/js/session.js — shared on every page. Keeps the "Account"
// nav link in sync with whether the visitor is signed in, using the
// Backend/ auth API (see Backend/routes/auth.js).
//
// Looks for <a id="accountNavLink" data-login-href="..." data-home-href="...">
// which every page's nav now includes (see index.html, about.html, etc.)
// -----------------------------------------------------------------
// When the site is started through Backend/server.js, the page and API share
// one origin. Keeping localhost as a fallback also supports an existing
// separate static server during development.
const AUTH_API_BASE_URL = window.location.protocol === 'http:' || window.location.protocol === 'https:'
  ? window.location.origin
  : 'http://localhost:4000';
const AUTH_TOKEN_KEY = 'sv_auth_token';
const AUTH_USER_KEY = 'sv_auth_user';

function svGetToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function svSetSession(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function svClearSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function svLogout(homeHref) {
  var token = svGetToken();
  svClearSession();
  if (token) {
    fetch(AUTH_API_BASE_URL + '/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token }
    }).catch(function () { /* token is cleared locally regardless */ });
  }
  window.location.href = homeHref || 'index.html';
}

document.addEventListener('DOMContentLoaded', function () {
  // A social (OAuth) sign-in returns with a Supabase session but no sv_auth_token yet.
  var pre = (!svGetToken() && window.svSupabase)
    ? window.svSupabase.auth.getSession().then(function (r) {
        if (r.data && r.data.session) localStorage.setItem(AUTH_TOKEN_KEY, r.data.session.access_token);
      }).catch(function () {})
    : Promise.resolve();
  pre.then(svInitAccountNav);
});

function svInitAccountNav() {
  var link = document.getElementById('accountNavLink');
  if (!link) return;

  var loginHref = link.getAttribute('data-login-href') || link.getAttribute('href');
  var homeHref = link.getAttribute('data-home-href') || 'index.html';
  var token = svGetToken();

  if (!token) {
    link.textContent = 'Account';
    link.setAttribute('href', loginHref);
    if (typeof window.svApplyLang === 'function' && typeof window.svGetLang === 'function') {
      window.svApplyLang(window.svGetLang());
    }
    return;
  }

  // We have a token — verify it's still valid before trusting the
  // cached user info (a session can expire or be revoked).
  fetch(AUTH_API_BASE_URL + '/api/auth/me', {
    headers: { Authorization: 'Bearer ' + token }
  })
    .then(function (r) {
      if (!r.ok) throw new Error('invalid session');
      return r.json();
    })
    .then(function (data) {
      svSetSession(token, data.user);
      renderLoggedIn(link, data.user, homeHref);

      // Logged-in visitors don't need the login/register forms — send
      // them home with a friendly note instead of letting them sit on
      // a page that doesn't apply to them anymore.
      var path = window.location.pathname;
      if (/\/(login|register)\.html$/.test(path)) {
        var params = new URLSearchParams(window.location.search);
        var redirectTo = params.get('redirect');
        window.alert('You\'re already logged in as ' + data.user.firstName + '.');
        window.location.href = redirectTo || homeHref;
      }
    })
    .catch(function () {
      // Session expired/invalid — fall back to logged-out state.
      svClearSession();
      link.textContent = 'Account';
      link.setAttribute('href', loginHref);
      if (typeof window.svApplyLang === 'function' && typeof window.svGetLang === 'function') {
        window.svApplyLang(window.svGetLang());
      }
    });
}

function renderLoggedIn(link, user, homeHref) {
  // homeHref is "index.html" on root pages, "../index.html" one level
  // down — strip the filename to get the right relative prefix for
  // every link this dropdown needs (Settings, FAQ placeholders, etc).
  var prefix = homeHref.replace(/index\.html$/, '');
  var wrap = document.getElementById('accountNavWrap');
  if (!wrap) return;

  var initial = (user.firstName || '?').charAt(0).toUpperCase();
  var fullName = user.firstName + ' ' + user.lastName;
  // Shows the uploaded profile picture when there is one (see
  // Account/settings.html -> POST/DELETE /api/auth/avatar), falling
  // back to the initial-letter circle everyone starts with.
  var avatarInner = user.avatarUrl
    ? '<img src="' + (/^https?:/.test(user.avatarUrl) ? user.avatarUrl : prefix + user.avatarUrl.replace(/^\//, '')) + '" alt="">'
    : initial;

  var adminLinks = '';
  if (user.isAdmin) {
    adminLinks =
      '<div class="dropdown-divider"></div>' +
      '<div class="account-dropdown-section-label" data-i18n="Admin">Admin</div>' +
      '<a href="' + prefix + 'contact-inbox.html"><i class="fa fa-inbox"></i><span data-i18n="Contact Inbox">Contact Inbox</span></a>' +
      '<a href="' + prefix + 'Account/settings.html#manage-users"><i class="fa fa-users"></i><span data-i18n="Manage Users">Manage Users</span></a>';
  }

  wrap.innerHTML =
    '<div class="account-icons">' +
      '<a class="account-icon-btn" href="' + prefix + 'Account/messages.html" title="Messages"><i class="fa fa-envelope-o"></i></a>' +
      '<a class="account-icon-btn" href="' + prefix + 'Account/notifications.html" title="Notifications"><i class="fa fa-bell-o"></i><span class="notif-badge" id="notifBadge" style="display:none;"></span></a>' +
      '<button type="button" class="account-avatar-btn" id="accountAvatarBtn" aria-haspopup="true" aria-expanded="false">' +
        '<span class="account-avatar-circle">' + avatarInner + '</span>' +
      '</button>' +
    '</div>' +
    '<div class="account-dropdown-menu" id="accountDropdownMenu">' +
      '<div class="account-dropdown-header">' +
        '<span class="account-avatar-circle account-dropdown-avatar">' + avatarInner + '</span>' +
        '<div class="account-dropdown-header-text">' +
          '<div class="name">' + fullName + '</div>' +
          '<div class="email">' + user.email + '</div>' +
        '</div>' +
      '</div>' +
      '<a href="' + prefix + 'Account/settings.html"><i class="fa fa-cog"></i><span data-i18n="Settings & Privacy">Settings &amp; Privacy</span></a>' +
      '<a href="' + prefix + 'Account/settings.html#display"><i class="fa fa-adjust"></i><span data-i18n="Display">Display</span></a>' +
      '<a href="' + prefix + 'Account/settings.html#accessibility"><i class="fa fa-wheelchair"></i><span data-i18n="Accessibility">Accessibility</span></a>' +
      '<a href="' + prefix + 'scottpdf/"><i class="fa fa-file-pdf-o"></i><span data-i18n="ScottPdf Tools">ScottPdf Tools</span></a>' +
      '<a href="' + prefix + 'scottimg/"><i class="fa fa-picture-o"></i><span data-i18n="ScottImg Tools">ScottImg Tools</span></a>' +
      adminLinks +
      '<div class="dropdown-divider"></div>' +
      '<button type="button" class="dropdown-item-btn" id="accountLogoutBtn"><i class="fa fa-sign-out"></i><span data-i18n="Log out">Log out</span></button>' +
    '</div>';

  // The dropdown was just built with fresh English text — if the
  // visitor already picked a language earlier, re-apply it now so the
  // dropdown doesn't sit in English until they touch the switcher again.
  if (typeof window.svApplyLang === 'function' && typeof window.svGetLang === 'function') {
    window.svApplyLang(window.svGetLang());
  }

  var avatarBtn = document.getElementById('accountAvatarBtn');
  var menu = document.getElementById('accountDropdownMenu');

  avatarBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var isOpen = menu.classList.toggle('open');
    avatarBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  document.addEventListener('click', function (e) {
    if (!wrap.contains(e.target)) {
      menu.classList.remove('open');
      avatarBtn.setAttribute('aria-expanded', 'false');
    }
  });
  document.getElementById('accountLogoutBtn').addEventListener('click', function () {
    if (window.confirm('Log out of ScottVentures?')) {
      svLogout(homeHref);
    }
  });

  fetch(AUTH_API_BASE_URL + '/api/notifications', {
    headers: { Authorization: 'Bearer ' + svGetToken() }
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var badge = document.getElementById('notifBadge');
      if (badge && data.unreadCount > 0) {
        badge.textContent = data.unreadCount > 9 ? '9+' : data.unreadCount;
        badge.style.display = 'flex';
      }
    })
    .catch(function () {});
}
