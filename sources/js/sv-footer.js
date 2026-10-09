// sv-footer.js — upgrades the shared site footer on every page: brand + tagline,
// social links, newsletter sign-up, tidier columns and a proper copyright bar.
// The existing link columns and language switcher are kept (i18n.js relies on them).
(function () {
  'use strict';
  var ROOT = window.SV_SITE_ROOT || '';
  var css = '\
.footer-main{background:linear-gradient(180deg,#23252d 0%,#1b1c22 100%)!important;border-top:3px solid #d93a35;padding:0!important;color:#c9ccd6}\
.footer-main .sv-ftop{display:flex;flex-wrap:wrap;gap:36px;justify-content:space-between;align-items:flex-start;padding:56px 0 40px;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:44px}\
.sv-fbrand{flex:1 1 320px;max-width:460px}\
.sv-fbrand img{height:42px;margin-bottom:16px;display:block}\
.sv-fbrand p{margin:0 0 18px;color:#aab0bf;font-size:.92rem;line-height:1.7}\
.sv-fsocial{display:flex;gap:10px}\
.sv-fsocial a{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;display:flex;align-items:center;justify-content:center;transition:all .2s}\
.sv-fsocial a:hover{background:#d93a35;transform:translateY(-2px)}\
.sv-fnews{flex:1 1 340px;max-width:460px}\
.sv-fnews h4{color:#fff;font-size:1.05rem;font-weight:600;margin:0 0 6px}\
.sv-fnews p{margin:0 0 14px;color:#aab0bf;font-size:.88rem}\
.sv-fnews form{display:flex;gap:8px;margin:0}\
.sv-fnews input[type=email]{flex:1 1 auto;min-width:0;height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff;padding:0 14px;font-size:.9rem;outline:0}\
.sv-fnews input::placeholder{color:#8a90a0}\
.sv-fnews input:focus{border-color:#d93a35}\
.sv-fnews button{flex:0 0 auto;height:44px;border:0;border-radius:10px;background:#d93a35;color:#fff;font-weight:600;padding:0 22px;cursor:pointer;transition:background .2s}\
.sv-fnews button:hover{background:#b92d29}.sv-fnews button:disabled{opacity:.6}\
.sv-fmsg{min-height:20px;margin:10px 0 0;font-size:.82rem;color:#aab0bf}.sv-fmsg.ok{color:#6fd89a}.sv-fmsg.err{color:#ff9d9a}\
.footer-main .footer-main__row{padding-bottom:36px!important}\
.footer-main .footer-main__title{font-size:.8rem!important;letter-spacing:.1em;color:#fff!important;padding-bottom:18px!important}\
.footer-main .footer-main__nav li{margin-bottom:12px!important}\
.footer-main .footer-main__nav li a{color:#aab0bf!important;font-size:.9rem!important;transition:color .15s,padding-left .15s;text-decoration:none!important}\
.footer-main .footer-main__nav li a:hover{color:#fff!important;padding-left:4px}\
.footer-main .separator{display:none}\
.footer-main .sv-fbar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:14px;border-top:1px solid rgba(255,255,255,.1);padding:24px 0 30px;font-size:.84rem;color:#8a90a0}\
.footer-main .sv-fbar a{color:#aab0bf;margin-left:18px}.footer-main .sv-fbar a:hover{color:#fff}\
.footer-main .sv-fbar-links a:first-child{margin-left:0}\
@media(max-width:575px){.footer-main .sv-ftop{padding-top:40px}.sv-fnews form{flex-direction:column}.sv-fnews button{width:100%}}';

  function ico(path) { return '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">' + path + '</svg>'; }

  function build() {
    var foot = document.querySelector('.footer-main');
    if (!foot || foot.getAttribute('data-sv-footer')) return;
    foot.setAttribute('data-sv-footer', '1');
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var container = foot.querySelector('.container') || foot;
    var row = container.querySelector('.footer-main__row');

    var top = document.createElement('div'); top.className = 'sv-ftop';
    top.innerHTML =
      '<div class="sv-fbrand"><img src="' + ROOT + 'sources/images/logo-nav.png" alt="ScottVentures">' +
      '<p>Clear tech explainers, hands-on tutorials and practical ICT services — written for curious people, from Mombasa, Kenya.</p>' +
      '<div class="sv-fsocial">' +
        '<a href="https://www.facebook.com/Scott.TechStar" target="_blank" rel="noopener" aria-label="Facebook">' + ico('<path d="M13.5 22v-8h2.7l.5-3.2h-3.2V8.7c0-.9.4-1.7 1.8-1.7h1.5V4.2S15.5 4 14.3 4C11.8 4 10.3 5.5 10.3 8.3v2.5H7.5V14h2.8v8z"/>') + '</a>' +
        '<a href="https://twitter.com/JohnnieCourtnie" target="_blank" rel="noopener" aria-label="X (Twitter)">' + ico('<path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z"/>') + '</a>' +
        '<a href="https://www.linkedin.com/in/john-mwadime-ba4428161/" target="_blank" rel="noopener" aria-label="LinkedIn">' + ico('<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4z"/>') + '</a>' +
      '</div></div>' +
      '<div class="sv-fnews"><h4>Get new articles in your inbox</h4><p>One short email when we publish something worth reading. No spam.</p>' +
      '<form novalidate><input type="email" name="email" placeholder="you@example.com" autocomplete="email" aria-label="Email address" required><button type="submit">Subscribe</button></form>' +
      '<p class="sv-fmsg" role="status" aria-live="polite"></p></div>';
    container.insertBefore(top, row || container.firstChild);

    var f = top.querySelector('form'), msg = top.querySelector('.sv-fmsg'), btn = f.querySelector('button'), inp = f.querySelector('input');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = inp.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'sv-fmsg err'; msg.textContent = 'Please enter a valid email address.'; return; }
      btn.disabled = true; msg.className = 'sv-fmsg'; msg.textContent = 'Subscribing…';
      var base = /^https?:/.test(location.protocol) ? location.origin : 'http://localhost:4000';
      fetch(base + '/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (r) {
          msg.className = 'sv-fmsg ' + (r.ok ? 'ok' : 'err');
          msg.textContent = r.j.message || r.j.error || (r.ok ? 'Thanks — you are subscribed!' : 'Could not subscribe right now.');
          if (r.ok) inp.value = '';
        })
        .catch(function () { msg.className = 'sv-fmsg err'; msg.textContent = "Couldn't reach the server. Please try again."; })
        .then(function () { btn.disabled = false; });
    });

    // honest labels for the two tool links
    Array.prototype.forEach.call(foot.querySelectorAll('.footer-main__nav a'), function (a) {
      var h = a.getAttribute('href') || '';
      if (/scottpdf\/index\.html$/.test(h)) a.textContent = 'ScottPDF';
      if (/scottimg\/index\.html$/.test(h)) a.textContent = 'ScottIMG';
    });

    // replace the tiny slogan line with a proper copyright bar
    var info = container.querySelector('.footer-main__info');
    var info2 = info && info.closest('.col-md-8');
    if (info2) {
      var bar = document.createElement('div'); bar.className = 'sv-fbar';
      bar.innerHTML = '<span>&copy; ' + new Date().getFullYear() + ' ScottVentures. All rights reserved.</span>' +
        '<span class="sv-fbar-links"><a href="' + ROOT + 'privacy-policy.html">Privacy</a><a href="' + ROOT + 'terms.html">Terms</a><a href="' + ROOT + 'help/cookies.html">Cookies</a><a href="' + ROOT + 'sitemap.xml">Sitemap</a></span>';
      info2.innerHTML = ''; info2.className = 'col-md-8'; info2.appendChild(bar);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
