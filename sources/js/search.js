// search.js — site search. Injects a compact search icon into the
// nav (so no HTML edits were needed across every page) and a
// full-screen overlay with live results as you type, using the
// static index in search-data.js.

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var accountItem = document.getElementById('account-nav-item');
    var navList = accountItem ? accountItem.parentElement : null;
    if (!navList) return; // page doesn't have the standard nav — skip

    // Reuse the same relative-path trick as session.js: the account
    // link already encodes how deep this page is (e.g. "../index.html"
    // one level down), so strip the filename to get the right prefix.
    var accountLink = document.getElementById('accountNavLink');
    var homeHref = accountLink ? (accountLink.getAttribute('data-home-href') || 'index.html') : 'index.html';
    var prefix = homeHref.replace(/index\.html$/, '');

    var searchLi = document.createElement('li');
    searchLi.className = 'nav-item';
    searchLi.innerHTML = '<button type="button" class="nav-search-btn" id="navSearchBtn" title="Search articles"><i class="fa fa-search"></i></button>';
    navList.insertBefore(searchLi, accountItem);

    var overlay = document.createElement('div');
    overlay.id = 'searchOverlay';
    overlay.className = 'search-overlay';
    overlay.innerHTML =
      '<div class="search-overlay-inner">' +
        '<div class="search-input-row">' +
          '<i class="fa fa-search"></i>' +
          '<input type="text" id="searchInput" placeholder="Search articles…" autocomplete="off">' +
          '<button type="button" id="searchCloseBtn" class="search-close-btn"><i class="fa fa-times"></i></button>' +
        '</div>' +
        '<div id="searchResults" class="search-results"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var input = document.getElementById('searchInput');
    var results = document.getElementById('searchResults');

    function openOverlay() {
      overlay.classList.add('open');
      input.value = '';
      renderResults('');
      setTimeout(function () { input.focus(); }, 50);
    }
    function closeOverlay() {
      overlay.classList.remove('open');
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function renderResults(query) {
      var q = query.trim().toLowerCase();
      var matches = !q ? SV_SEARCH_INDEX : SV_SEARCH_INDEX.filter(function (item) {
        return item.title.toLowerCase().indexOf(q) !== -1 || item.desc.toLowerCase().indexOf(q) !== -1;
      });

      if (!matches.length) {
        results.innerHTML = '<p class="search-empty">No articles match "' + escapeHtml(query) + '".</p>';
        return;
      }

      results.innerHTML = matches.map(function (item) {
        return '<a class="search-result" href="' + prefix + item.href + '">' +
          '<div class="search-result-title">' + escapeHtml(item.title) + '</div>' +
          '<div class="search-result-desc">' + escapeHtml(item.desc) + '</div>' +
        '</a>';
      }).join('');
    }

    document.getElementById('navSearchBtn').addEventListener('click', openOverlay);
    document.getElementById('searchCloseBtn').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeOverlay();
      // Quick-open with "/" when not already typing in a field.
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        openOverlay();
      }
    });
    input.addEventListener('input', function () { renderResults(input.value); });
  });
})();
