// sv-shield.js — browser-side bot defences. These stop automated form-fillers;
// the real enforcement (rate limits, captcha on sign-in) lives in Supabase —
// see supabase/hardening.sql and supabase/README.md.
(function () {
  'use strict';
  var cfg = window.SV_SUPABASE || {};
  var siteKey = cfg.turnstileSiteKey || '';
  var loadedAt = Date.now();
  var widgets = {};          // form id -> widget id
  var tokens = {};           // form id -> latest token
  var CAPTCHA_FORMS = ['registerForm', 'loginForm', 'forgotPasswordForm', 'contact'];

  // 1. Clickjacking: refuse to run inside someone else's frame.
  try {
    if (window.top !== window.self) {
      document.documentElement.style.display = 'none';
      window.top.location = window.self.location;
    }
  } catch (e) { document.documentElement.style.display = 'none'; }

  // 2. Don't leak full URLs (reset tokens etc.) to third parties.
  if (!document.querySelector('meta[name="referrer"]')) {
    var m = document.createElement('meta'); m.name = 'referrer'; m.content = 'strict-origin-when-cross-origin';
    document.head.appendChild(m);
  }

  // 3. Honeypot + time-trap on every form that submits data.
  function armForms() {
    Array.prototype.forEach.call(document.forms, function (form) {
      if (form.getAttribute('data-sv-armed') || form.getAttribute('role') === 'search') return;
      if (!form.querySelector('input,textarea')) return;
      form.setAttribute('data-sv-armed', '1');
      var hp = document.createElement('input');
      hp.type = 'text'; hp.name = '_website'; hp.tabIndex = -1; hp.autocomplete = 'off';
      hp.setAttribute('aria-hidden', 'true');
      hp.style.cssText = 'position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0;pointer-events:none';
      form.appendChild(hp);
      form.addEventListener('submit', function (e) {
        var tooFast = Date.now() - loadedAt < 2500;
        if (hp.value || tooFast) {
          e.preventDefault(); e.stopImmediatePropagation();
          if (tooFast && !hp.value) note(form, 'Please take a moment to complete the form, then submit again.');
          // honeypot hit: say nothing — bots get no signal
        }
      }, true);
    });
  }

  function note(form, text) {
    var el = form.querySelector('.tn-comment-status, .auth-status, [role="alert"]');
    if (el) { el.textContent = text; el.className = (el.className || '').replace(/\b(success|error)\b/g, '') + ' error'; }
  }

  // 4. Cloudflare Turnstile (only when a site key is configured).
  function loadTurnstile(cb) {
    if (window.turnstile) return cb();
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true; s.onload = cb;
    document.head.appendChild(s);
  }
  function mountCaptcha() {
    if (!siteKey) return;
    var present = CAPTCHA_FORMS.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!present.length) return;
    loadTurnstile(function () {
      present.forEach(function (form) {
        var box = document.createElement('div');
        box.className = 'sv-turnstile'; box.style.cssText = 'margin:14px 0;display:flex;justify-content:center';
        var btn = form.querySelector('button[type="submit"],input[type="submit"]');
        if (btn && btn.parentNode) btn.parentNode.insertBefore(box, btn); else form.appendChild(box);
        widgets[form.id] = window.turnstile.render(box, {
          sitekey: siteKey, theme: 'light',
          callback: function (t) { tokens[form.id] = t; },
          'expired-callback': function () { tokens[form.id] = ''; },
          'error-callback': function () { tokens[form.id] = ''; }
        });
        form.addEventListener('submit', function (e) {
          if (!tokens[form.id]) {
            e.preventDefault(); e.stopImmediatePropagation();
            note(form, 'Please complete the security check first.');
          } else {
            // tokens are single-use: refresh after the request has gone out
            setTimeout(function () { try { window.turnstile.reset(widgets[form.id]); tokens[form.id] = ''; } catch (x) {} }, 4000);
          }
        }, true);
      });
    });
  }

  window.svShield = {
    // token for Supabase Auth (Authentication → Attack Protection → CAPTCHA)
    captchaToken: function (formId) { return tokens[formId] || undefined; },
    enabled: !!siteKey
  };

  document.addEventListener('DOMContentLoaded', function () { armForms(); mountCaptcha(); });
})();
