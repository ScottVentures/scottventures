// sv-chat.js — floating help assistant.
//  * If the Supabase Edge Function `chat` is deployed, answers come from the AI model
//    (the API key stays on the server — never in this file).
//  * Otherwise (or if it is unreachable) it answers locally from the site's own
//    article index and key pages, so it is useful from day one.
(function () {
  'use strict';
  var cfg = window.SV_SUPABASE || {};
  if (cfg.chatbotEnabled === false) return;
  var ROOT = window.SV_SITE_ROOT || '';
  var remoteOK = !!(cfg.url && cfg.anonKey && cfg.url.indexOf('YOUR_') !== 0);
  var history = [];
  var busy = false;
  var lastSent = 0;
  var MAX_LEN = 500;

  var PAGES = [
    { k: ['contact', 'reach', 'email', 'support', 'help', 'hire', 'service', 'ict', 'business', 'quote', 'partner', 'advert'], t: 'Contact us', h: 'contact.html', a: 'You can reach us through the contact form — tell us what you need (ICT services, support, partnerships) and we will reply by email.' },
    { k: ['about', 'who', 'team', 'founder', 'story', 'mission'], t: 'About ScottVentures', h: 'about.html', a: 'ScottVentures is a tech site with clear, short articles, tutorials and learning materials, plus ICT services, based in Mombasa, Kenya.' },
    { k: ['tutorial', 'guide', 'course', 'learn', 'step'], t: 'Tutorials', h: 'tutorials.html', a: 'Our tutorials are hands-on, step-by-step guides.' },
    { k: ['material', 'study', 'resource', 'notes'], t: 'Learning materials', h: 'learning-materials.html', a: 'Learning materials collects organised study resources.' },
    { k: ['article', 'blog', 'read', 'post'], t: 'Articles', h: 'products.html', a: 'Browse all our articles and insights here.' },
    { k: ['pdf', 'merge', 'split', 'compress', 'convert'], t: 'ScottPDF tools', h: 'scottpdf/index.html', a: 'ScottPDF has tools to merge, split, compress and convert PDFs. Some tools are coming soon.' },
    { k: ['image', 'img', 'resize', 'crop', 'photo', 'meme', 'watermark'], t: 'ScottIMG tools', h: 'scottimg/index.html', a: 'ScottIMG covers resizing, cropping, compressing and converting images. Some tools are coming soon.' },
    { k: ['login', 'log in', 'sign in', 'register', 'sign up', 'account', 'password', 'join'], t: 'Create an account', h: 'Account/register.html', a: 'Create a free account to comment, react, use the forum and message other members. Already registered? Log in from the same menu.' },
    { k: ['privacy', 'data', 'cookie', 'terms', 'legal', 'secure', 'security'], t: 'Privacy policy', h: 'privacy-policy.html', a: 'Your details are only used to respond to you and run your account. See our privacy policy and terms for details.' },
    { k: ['faq', 'question', 'how do'], t: 'FAQ', h: 'faq.html', a: 'Many common questions are answered in the FAQ.' }
  ];

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' '); }
  function words(s) { return norm(s).split(/\s+/).filter(function (w) { return w.length > 2; }); }

  function loadIndex(cb) {
    if (window.SV_SEARCH_INDEX) return cb(window.SV_SEARCH_INDEX);
    var s = document.createElement('script');
    s.src = ROOT + 'sources/js/search-data.js';
    s.onload = function () { cb(window.SV_SEARCH_INDEX || []); };
    s.onerror = function () { cb([]); };
    document.head.appendChild(s);
  }

  function localAnswer(q, cb) {
    var qw = words(q), qn = norm(q);
    if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(qn.trim())) {
      return cb({ text: 'Hello! I can point you to articles, tutorials, tools or tell you how to get in touch. What are you looking for?', links: [] });
    }
    var best = null, bs = 0;
    PAGES.forEach(function (p) {
      var sc = 0; p.k.forEach(function (k) { if (qn.indexOf(k) >= 0) sc += k.indexOf(' ') > 0 ? 3 : 2; });
      if (sc > bs) { bs = sc; best = p; }
    });
    loadIndex(function (idx) {
      var hits = idx.map(function (a) {
        var hay = norm(a.title + ' ' + a.desc), sc = 0;
        qw.forEach(function (w) { if (hay.indexOf(w) >= 0) sc += 1; });
        return { a: a, sc: sc };
      }).filter(function (x) { return x.sc > 0; }).sort(function (x, y) { return y.sc - x.sc; }).slice(0, 3);
      var links = hits.map(function (x) { return { t: x.a.title, h: x.a.href }; });
      var text;
      if (best && bs >= 2 && !(links.length && hits[0].sc >= 2 && bs < 4)) {
        text = best.a; links = [{ t: best.t, h: best.h }].concat(links);
      } else if (links.length) {
        text = 'Here are some articles that may help:';
      } else {
        text = "I couldn't find a close match. Try different keywords, search the articles, or send us a message and we'll help personally.";
        links = [{ t: 'Browse articles', h: 'products.html' }, { t: 'Contact us', h: 'contact.html' }];
      }
      cb({ text: text, links: links });
    });
  }

  function remoteAnswer(cb, fail) {
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 25000);
    fetch(cfg.url.replace(/\/$/, '') + '/functions/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey },
      body: JSON.stringify({ messages: history.slice(-10) }),
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j }; });
    }).then(function (res) {
      clearTimeout(timer);
      if (res.status === 404 || res.status === 401) { remoteOK = false; return fail(); }
      if (res.status === 429) return cb({ text: 'You are sending messages quickly — please wait a few minutes and try again.', links: [] });
      if (res.status >= 400 || !res.body || !res.body.reply) return fail();
      cb({ text: res.body.reply, links: [] });
    }).catch(function () { clearTimeout(timer); fail(); });
  }

  // ---------- UI ----------
  var css = '\
#svChatBtn{position:fixed;right:20px;bottom:20px;z-index:99990;width:58px;height:58px;border-radius:50%;border:0;background:#d93a35;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.28);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .2s}\
#svChatBtn:hover{transform:scale(1.07)}\
#svChat{position:fixed;right:20px;bottom:92px;z-index:99991;width:360px;max-width:calc(100vw - 24px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;font-family:Poppins,Arial,sans-serif}\
#svChat.open{display:flex}\
#svChat header{background:#22252d;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}\
#svChat header b{font-size:.98rem}#svChat header small{display:block;color:#aab;font-size:.72rem;font-weight:400}\
#svChat header button{background:none;border:0;color:#fff;font-size:1.4rem;cursor:pointer;line-height:1}\
#svChatLog{flex:1;overflow-y:auto;padding:14px;background:#f6f8fc}\
.svm{max-width:86%;margin:0 0 10px;padding:10px 13px;border-radius:14px;font-size:.88rem;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}\
.svm.bot{background:#fff;color:#223;box-shadow:0 2px 8px rgba(30,50,90,.08);border-bottom-left-radius:4px}\
.svm.me{background:#d93a35;color:#fff;margin-left:auto;border-bottom-right-radius:4px}\
.svm a.svl{display:block;margin-top:8px;padding:7px 10px;background:#f0f3fa;border-radius:8px;color:#2f5bb0;font-weight:600;text-decoration:none;font-size:.82rem}\
.svm a.svl:hover{background:#e2e9f8}\
.svchips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}\
.svchips button{border:1px solid #d6dbe6;background:#fff;border-radius:50px;padding:5px 12px;font-size:.78rem;cursor:pointer;color:#334}\
.svchips button:hover{border-color:#d93a35;color:#d93a35}\
#svChat,#svChat *{box-sizing:border-box}\
#svChat form{display:flex;align-items:center;margin:0;gap:8px;padding:10px;border-top:1px solid #eef0f5;background:#fff}\
#svChat input{flex:1 1 auto;min-width:0;width:auto;height:40px;margin:0;border:1px solid #d6dbe6;border-radius:50px;padding:0 14px;font-size:.88rem;outline:0;background:#fff;box-shadow:none}\
#svChat input:focus{border-color:#d93a35}\
#svChat form button{flex:0 0 auto;height:40px;border:0;background:#d93a35;color:#fff;border-radius:50px;padding:0 18px;font-weight:600;cursor:pointer}\
#svChat form button:disabled{opacity:.5}\
.svdots span{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:#99a;animation:svb 1s infinite}.svdots span:nth-child(2){animation-delay:.15s}.svdots span:nth-child(3){animation-delay:.3s}\
@keyframes svb{0%,80%,100%{opacity:.3}40%{opacity:1}}\
@media(max-width:480px){#svChat{right:12px;bottom:84px;height:calc(100vh - 110px)}#svChatBtn{right:14px;bottom:14px}}';

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var btn = el('button'); btn.id = 'svChatBtn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Open chat assistant');
    btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    var box = el('div'); box.id = 'svChat'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'ScottVentures assistant');
    box.innerHTML = '<header><div><b>ScottVentures Assistant</b><small>Ask about articles, tutorials, tools or services</small></div><button type="button" aria-label="Close chat">&times;</button></header><div id="svChatLog" aria-live="polite"></div><form autocomplete="off"><input type="text" maxlength="' + MAX_LEN + '" placeholder="Type your question…" aria-label="Your question"><button type="submit">Send</button></form>';
    document.body.appendChild(btn); document.body.appendChild(box);
    var log = box.querySelector('#svChatLog'), form = box.querySelector('form'), input = box.querySelector('input'), send = form.querySelector('button');

    function add(text, who, links) {
      var m = el('div', 'svm ' + who, text);
      (links || []).forEach(function (l) {
        var a = el('a', 'svl', l.t + ' →'); a.href = /^https?:/.test(l.h) ? l.h : ROOT + l.h; m.appendChild(a);
      });
      log.appendChild(m); log.scrollTop = log.scrollHeight; return m;
    }
    function chips() {
      var w = el('div', 'svchips');
      ['Latest articles', 'How do I contact you?', 'Do you offer ICT services?', 'Create an account'].forEach(function (q) {
        var b = el('button', '', q); b.type = 'button'; b.onclick = function () { w.remove(); ask(q); }; w.appendChild(b);
      });
      log.appendChild(w);
    }
    function ask(q) {
      q = q.trim().slice(0, MAX_LEN);
      if (!q || busy) return;
      if (Date.now() - lastSent < 1500) return;   // client-side throttle
      lastSent = Date.now(); busy = true; send.disabled = true;
      add(q, 'me'); history.push({ role: 'user', content: q });
      var typing = el('div', 'svm bot'); typing.innerHTML = '<span class="svdots"><span></span><span></span><span></span></span>'; log.appendChild(typing); log.scrollTop = log.scrollHeight;
      function done(ans) {
        typing.remove(); add(ans.text, 'bot', ans.links); history.push({ role: 'assistant', content: ans.text });
        busy = false; send.disabled = false; input.focus();
      }
      function local() { localAnswer(q, done); }
      if (remoteOK) remoteAnswer(done, local); else local();
    }
    function open() { box.classList.add('open'); if (!log.children.length) { add('Hi! I\'m the ScottVentures assistant. How can I help?', 'bot'); chips(); } setTimeout(function () { input.focus(); }, 50); }
    btn.onclick = function () { box.classList.contains('open') ? box.classList.remove('open') : open(); };
    box.querySelector('header button').onclick = function () { box.classList.remove('open'); };
    form.onsubmit = function (e) { e.preventDefault(); var v = input.value; input.value = ''; ask(v); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.classList.remove('open'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
