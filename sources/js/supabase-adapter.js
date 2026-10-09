// -----------------------------------------------------------------
// supabase-adapter.js — lets the existing pages keep calling the old
// "/api/..." endpoints while the data now lives in Supabase.
//
// GitHub Pages (and any static host) cannot run the old Express/SQLite
// server, so this file intercepts fetch('/api/...') in the browser and
// answers it using supabase-js (Auth + Postgres/RLS + Storage). The
// response shapes are identical to the old API, so the page scripts did
// not need rewriting. Load order on each page:
//   vendor/supabase.js -> supabase-config.js -> supabase-adapter.js
// -----------------------------------------------------------------
(function () {
  'use strict';

  var cfg = window.SV_SUPABASE || {};
  var configured = !!(cfg.url && cfg.anonKey && !/YOUR_SUPABASE/.test(cfg.url + cfg.anonKey));
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  var API_RE = /\/api\/(auth|reactions|comments|forum|notifications|messages|contact|subscribe|admin)(\/|$)/;

  // Site root (works on https://user.github.io/repo/ and on a real domain):
  // this script lives at <root>/sources/js/supabase-adapter.js
  var SITE_ROOT = (function () {
    var src = document.currentScript && document.currentScript.src;
    if (!src) return window.location.origin + '/';
    return src.replace(/sources\/js\/supabase-adapter\.js.*$/, '');
  })();
  window.SV_SITE_ROOT = SITE_ROOT;

  var sb = null;
  function client() {
    if (sb) return sb;
    if (!configured || !window.supabase || !window.supabase.createClient) return null;
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'sv-supabase-auth' }
    });
    window.svSupabase = sb;
    return sb;
  }
  // Create immediately so a password-recovery link in the URL hash is consumed on page load.
  client();

  // ---------- helpers ----------
  function json(status, obj) {
    return new Response(JSON.stringify(obj), { status: status, headers: { 'Content-Type': 'application/json' } });
  }
  function fail(status, msg, extra) { return json(status, Object.assign({ error: msg }, extra || {})); }

  // Old API returned SQLite-style UTC timestamps: "YYYY-MM-DD HH:MM:SS"
  function fmt(ts) {
    if (!ts) return ts || null;
    var d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function str(v) { return typeof v === 'string' ? v : ''; }
  function rand() {
    var a = new Uint8Array(12); (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function extOf(name, fallback) {
    var m = /\.([a-zA-Z0-9]{1,8})$/.exec(name || '');
    return m ? '.' + m[1].toLowerCase() : (fallback || '');
  }
  // Map a Supabase/PostgREST error to an HTTP-ish response.
  var CAPTCHA_REAUTH = 'For your security, please log out, log in again and then repeat this action.';
  function cap(id) { return window.svShield ? window.svShield.captchaToken(id) : undefined; }

  function dbError(err, fallback) {
    var msg = (err && err.message) || fallback || 'Something went wrong. Please try again.';
    var status = 400;
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return fail(503, "Couldn't reach the database. Check your connection and try again.");
    }
    if (err && err.code === 'P0429') status = 429;
    if (err && (err.code === '42501' || /row-level security|permission denied|Admin account required/i.test(msg))) status = 403;
    if (/not logged in|jwt/i.test(msg)) status = 401;
    if (err && err.code === 'PGRST116') status = 404;
    return fail(status, msg);
  }

  function getSession() {
    var c = client();
    return c.auth.getSession().then(function (r) { return r.data && r.data.session; });
  }

  function publicUser(authUser, profile, isAdmin) {
    profile = profile || {};
    return {
      id: authUser.id,
      firstName: profile.first_name || (authUser.user_metadata && authUser.user_metadata.first_name) || '',
      lastName: profile.last_name || (authUser.user_metadata && authUser.user_metadata.last_name) || '',
      email: authUser.email,
      avatarUrl: profile.avatar_url || null,
      isAdmin: !!isAdmin,
      notifyLogin: profile.notify_login !== false,
      notifyReplies: profile.notify_replies !== false,
      notifyMessages: profile.notify_messages !== false
    };
  }

  // Returns { user: publicUser, authUser } or null when signed out.
  function currentUser(validate) {
    var c = client();
    var p = validate ? c.auth.getUser().then(function (r) { return r.data && r.data.user; })
                     : getSession().then(function (s) { return s && s.user; });
    return p.then(function (authUser) {
      if (!authUser) return null;
      return Promise.all([
        c.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
        c.rpc('is_admin')
      ]).then(function (res) {
        return { authUser: authUser, user: publicUser(authUser, res[0].data, res[1].data === true) };
      });
    }).catch(function () { return null; });
  }
  function requireUser(validate) { return currentUser(validate); }
  var NOT_LOGGED_IN = function () { return fail(401, 'Not logged in, or session expired.'); };

  function removeAvatarObject(url) {
    if (!url) return;
    var i = url.indexOf('/avatars/');
    if (i < 0) return;
    var p = decodeURIComponent(url.slice(i + '/avatars/'.length).split('?')[0]);
    client().storage.from('avatars').remove([p]).then(function () {}, function () {});
  }

  // ---------- AUTH ----------
  var auth = {
    register: function (b) {
      var first = str(b.firstName).trim(), last = str(b.lastName).trim(), email = str(b.email).trim().toLowerCase(), pw = str(b.password);
      if (!first || !last || !EMAIL_RE.test(email) || pw.length < 8 || pw.length > 200) {
        return Promise.resolve(fail(400, 'Fill in every field — password must be at least 8 characters.'));
      }
      return client().auth.signUp({
        email: email, password: pw,
        options: { data: { first_name: first, last_name: last }, emailRedirectTo: SITE_ROOT + 'Account/login.html', captchaToken: cap('registerForm') }
      }).then(function (r) {
        if (r.error) {
          if (/already|registered/i.test(r.error.message)) return fail(409, 'An account with that email already exists.');
          return fail(400, r.error.message);
        }
        if (r.data.user && r.data.user.identities && r.data.user.identities.length === 0) {
          return fail(409, 'An account with that email already exists.');
        }
        if (!r.data.session) {
          return json(202, { pendingConfirmation: true, email: email, message: 'We emailed a confirmation link to ' + email + '.' });
        }
        return currentUser(false).then(function (me) {
          return json(201, { token: r.data.session.access_token, user: me ? me.user : publicUser(r.data.user, { first_name: first, last_name: last }, false) });
        });
      });
    },
    login: function (b) {
      var email = str(b.email).trim().toLowerCase(), pw = str(b.password);
      if (!email || !pw) return Promise.resolve(fail(400, 'Incorrect email or password.'));
      return client().auth.signInWithPassword({ email: email, password: pw, options: { captchaToken: cap('loginForm') } }).then(function (r) {
        if (r.error) {
          if (/confirm/i.test(r.error.message)) return fail(401, 'Please confirm your email first — check your inbox for the link.');
          return fail(401, 'Incorrect email or password.');
        }
        client().rpc('notify_login').then(function () {}, function () {});
        return currentUser(false).then(function (me) {
          return json(200, { token: r.data.session.access_token, user: me.user });
        });
      });
    },
    logout: function () {
      return client().auth.signOut({ scope: 'local' }).then(function () { return json(200, { ok: true }); });
    },
    me: function () {
      return requireUser(true).then(function (me) { return me ? json(200, { user: me.user }) : NOT_LOGGED_IN(); });
    },
    profile: function (b) {
      return requireUser(false).then(function (me) {
        if (!me) return NOT_LOGGED_IN();
        var first = str(b.firstName).trim(), last = str(b.lastName).trim(), email = str(b.email).trim().toLowerCase();
        if (!first || !last || !EMAIL_RE.test(email)) return fail(400, 'Enter a valid first name, last name, and email.');
        var c = client();
        var emailChanged = email !== (me.user.email || '').toLowerCase();
        return c.from('profiles').update({ first_name: first, last_name: last }).eq('id', me.user.id).then(function (r) {
          if (r.error) return dbError(r.error);
          var emailChange = emailChanged
            ? c.auth.updateUser({ email: email }, { emailRedirectTo: SITE_ROOT + 'Account/login.html' }) : Promise.resolve({});
          return emailChange.then(function (e) {
            if (e.error) return fail(409, e.error.message);
            return currentUser(false).then(function (m2) {
              var out = { ok: true, user: m2.user };
              if (emailChanged) out.message = 'We sent a confirmation link to ' + email + '. Your email changes once you confirm it.';
              return json(200, out);
            });
          });
        });
      });
    },
    avatarUpload: function (file) {
      return requireUser(false).then(function (me) {
        if (!me) return NOT_LOGGED_IN();
        if (!file || !file.size) return fail(400, 'No file received.');
        if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].indexOf(file.type) < 0) return fail(400, 'Use a JPG, PNG, GIF, or WEBP image.');
        if (file.size > 5 * 1024 * 1024) return fail(400, 'Image must be 5MB or smaller.');
        var c = client();
        var path = me.user.id + '/' + rand() + extOf(file.name, '.jpg');
        var previous = me.user.avatarUrl;
        return c.storage.from('avatars').upload(path, file, { contentType: file.type, cacheControl: '3600' }).then(function (u) {
          if (u.error) return fail(400, u.error.message);
          var url = c.storage.from('avatars').getPublicUrl(path).data.publicUrl;
          return c.from('profiles').update({ avatar_url: url }).eq('id', me.user.id).then(function (r) {
            if (r.error) return dbError(r.error);
            removeAvatarObject(previous);
            return currentUser(false).then(function (m2) { return json(200, { ok: true, user: m2.user }); });
          });
        });
      });
    },
    avatarDelete: function () {
      return requireUser(false).then(function (me) {
        if (!me) return NOT_LOGGED_IN();
        return client().from('profiles').update({ avatar_url: null }).eq('id', me.user.id).then(function (r) {
          if (r.error) return dbError(r.error);
          removeAvatarObject(me.user.avatarUrl);
          return currentUser(false).then(function (m2) { return json(200, { ok: true, user: m2.user }); });
        });
      });
    },
    changePassword: function (b) {
      return requireUser(true).then(function (me) {
        if (!me) return NOT_LOGGED_IN();
        var cur = str(b.currentPassword), next = str(b.newPassword);
        if (!cur) return fail(400, 'Enter your current password.');
        if (next.length < 8 || next.length > 200) return fail(400, 'New password must be at least 8 characters.');
        var c = client();
        return c.auth.signInWithPassword({ email: me.user.email, password: cur }).then(function (r) {
          if (r.error) return fail(401, /captcha/i.test(r.error.message) ? CAPTCHA_REAUTH : 'Current password is incorrect.');
          return c.auth.updateUser({ password: next }).then(function (u) {
            if (u.error) return fail(400, u.error.message);
            return c.auth.signOut({ scope: 'others' }).then(function () { return json(200, { ok: true, message: 'Password updated.' }); });
          });
        });
      });
    },
    forgotPassword: function (b) {
      var email = str(b.email).trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return Promise.resolve(fail(400, 'Enter a valid email address.'));
      return client().auth.resetPasswordForEmail(email, { redirectTo: SITE_ROOT + 'Account/reset-password.html?token=supabase', captchaToken: cap('forgotPasswordForm') }).then(function () {
        return json(200, { ok: true, message: "If an account exists for that email, we've sent a reset link to it." });
      });
    },
    resetPassword: function (b) {
      var pw = str(b.password);
      if (pw.length < 8 || pw.length > 200) return Promise.resolve(fail(400, 'Password must be at least 8 characters.'));
      var c = client();
      return getSession().then(function (s) {
        if (!s) return fail(400, 'This reset link is invalid or has expired.');
        return c.auth.updateUser({ password: pw }).then(function (u) {
          if (u.error) return fail(400, u.error.message);
          return c.auth.signOut({ scope: 'local' }).then(function () {
            return json(200, { ok: true, message: 'Password updated — you can log in with your new password.' });
          });
        });
      });
    },
    notificationPrefs: function (b) {
      return requireUser(false).then(function (me) {
        if (!me) return NOT_LOGGED_IN();
        var patch = {};
        if (typeof b.notifyLogin === 'boolean') patch.notify_login = b.notifyLogin;
        if (typeof b.notifyReplies === 'boolean') patch.notify_replies = b.notifyReplies;
        if (typeof b.notifyMessages === 'boolean') patch.notify_messages = b.notifyMessages;
        var run = Object.keys(patch).length ? client().from('profiles').update(patch).eq('id', me.user.id) : Promise.resolve({});
        return run.then(function (r) {
          if (r.error) return dbError(r.error);
          return currentUser(false).then(function (m2) { return json(200, { ok: true, user: m2.user }); });
        });
      });
    },
    sessions: function () {
      return getSession().then(function (s) {
        if (!s) return NOT_LOGGED_IN();
        return json(200, { sessions: [{
          current: true,
          createdAt: fmt(s.user.last_sign_in_at || new Date().toISOString()),
          expiresAt: fmt(new Date((s.expires_at || 0) * 1000).toISOString())
        }] });
      });
    },
    logoutOthers: function () {
      return getSession().then(function (s) {
        if (!s) return NOT_LOGGED_IN();
        return client().auth.signOut({ scope: 'others' }).then(function () { return json(200, { ok: true, signedOutCount: 0 }); });
      });
    },
    exportData: function () {
      return requireUser(false).then(function (me) {
        if (!me) return NOT_LOGGED_IN();
        var c = client();
        return Promise.all([
          c.from('comments').select('article_id,message,created_at').eq('user_id', me.user.id).order('created_at', { ascending: false }),
          c.from('forum_posts').select('id,title,body,category,created_at').eq('user_id', me.user.id).order('created_at', { ascending: false })
        ]).then(function (r) {
          return json(200, {
            exportedAt: new Date().toISOString(),
            profile: { firstName: me.user.firstName, lastName: me.user.lastName, email: me.user.email, accountCreatedAt: fmt(me.authUser.created_at) },
            comments: (r[0].data || []).map(function (x) { return { article_id: x.article_id, message: x.message, created_at: fmt(x.created_at) }; }),
            forumPosts: (r[1].data || []).map(function (x) { x.created_at = fmt(x.created_at); return x; })
          });
        });
      });
    },
    deleteAccount: function (b) {
      return requireUser(true).then(function (me) {
        if (!me) return NOT_LOGGED_IN();
        var c = client();
        return c.auth.signInWithPassword({ email: me.user.email, password: str(b.password) }).then(function (r) {
          if (r.error) return fail(401, /captcha/i.test(r.error.message) ? CAPTCHA_REAUTH : 'Incorrect password.');
          return c.rpc('delete_my_account').then(function (d) {
            if (d.error) return fail(400, d.error.message);
            return c.auth.signOut({ scope: 'local' }).then(function () { return json(200, { ok: true }); });
          });
        });
      });
    }
  };

  // ---------- REACTIONS ----------
  function reactions(method, id, query, b) {
    var c = client();
    if (method === 'GET') {
      return c.rpc('get_reactions', { p_article: id, p_voter: query.get('voterId') || null }).then(function (r) {
        return r.error ? dbError(r.error) : json(200, r.data);
      });
    }
    return c.rpc('react', { p_article: id, p_voter: str(b.voterId), p_vote: str(b.vote) }).then(function (r) {
      return r.error ? dbError(r.error) : json(200, r.data);
    });
  }

  // ---------- COMMENTS ----------
  function commentRow(r) {
    return { id: r.id, name: r.name, message: r.message, created_at: fmt(r.created_at), parent_id: r.parent_id, is_owner: r.is_owner ? 1 : 0 };
  }
  function comments(method, id, b) {
    var c = client();
    if (method === 'GET') {
      return c.from('comments').select('id,name,message,created_at,parent_id,is_owner').eq('article_id', id)
        .order('created_at', { ascending: true }).then(function (r) {
          return r.error ? dbError(r.error) : json(200, { comments: (r.data || []).map(commentRow) });
        });
    }
    if (b._honey) return Promise.resolve(json(200, { ok: true }));
    var msg = str(b.message).trim();
    if (msg.length < 1 || msg.length > 1000) return Promise.resolve(fail(400, 'Comment must be 1-1000 characters'));
    var pid = (b.parent_id === undefined || b.parent_id === null || b.parent_id === '') ? null : Number(b.parent_id);
    if (pid !== null && !Number.isInteger(pid)) return Promise.resolve(fail(400, 'Invalid parent_id'));
    return getSession().then(function (s) {
      var name = str(b.name).trim();
      if (!s && (name.length < 1 || name.length > 60)) return fail(400, 'Name must be 1-60 characters');
      return c.rpc('add_comment', { p_article: id, p_name: escapeHtml(name), p_message: escapeHtml(msg), p_parent: pid }).then(function (r) {
        return r.error ? dbError(r.error) : json(201, { comment: commentRow(r.data) });
      });
    });
  }

  // ---------- FORUM ----------
  var CATEGORIES = ['general', 'help', 'showcase', 'career'];
  function serializePost(p, bookmarkedIds) {
    return {
      id: p.id, title: p.title, body: p.body, category: p.category,
      authorName: p.author_name, authorId: p.user_id, createdAt: fmt(p.created_at),
      pinned: !!p.pinned, views: p.views || 0, ups: p.ups || 0, downs: p.downs || 0,
      score: (p.ups || 0) - (p.downs || 0), yourVote: p.your_vote || null,
      commentCount: p.comment_count || 0, bookmarked: bookmarkedIds ? bookmarkedIds.has(p.id) : false
    };
  }
  function myBookmarks(s) {
    if (!s) return Promise.resolve(null);
    return client().from('forum_bookmarks').select('post_id').eq('user_id', s.user.id).then(function (r) {
      return new Set((r.data || []).map(function (x) { return x.post_id; }));
    });
  }
  function hotScore(score, createdAt) {
    var age = Math.max(0, (Date.now() - new Date(String(createdAt).replace(' ', 'T') + 'Z').getTime()) / 3600000);
    return score / Math.pow(age + 2, 1.5);
  }
  function fetchPost(id, voter, countView, s) {
    return client().rpc('forum_get_post', { p_id: id, p_voter: voter || null, p_count_view: !!countView }).then(function (r) {
      if (r.error) return { error: r.error };
      var row = (r.data || [])[0];
      if (!row) return { notFound: true };
      return myBookmarks(s).then(function (bm) { return { post: serializePost(row, bm) }; });
    });
  }
  function forum(method, parts, query, b) {
    var c = client();
    // parts: ['posts'] | ['posts', id] | ['posts', id, action]
    if (parts[0] !== 'posts') return Promise.resolve(fail(404, 'Not found.'));
    var id = parts[1] ? Number(parts[1]) : null;
    var action = parts[2];

    if (!id) {
      if (method === 'GET') {
        var sort = ['new', 'top', 'hot'].indexOf(query.get('sort')) >= 0 ? query.get('sort') : 'new';
        var category = query.get('category');
        var q = (query.get('q') || '').trim().toLowerCase();
        return getSession().then(function (s) {
          return Promise.all([c.rpc('forum_feed', { p_voter: query.get('voterId') || null }), myBookmarks(s)]).then(function (res) {
            if (res[0].error) return dbError(res[0].error);
            var bm = res[1];
            var rows = (res[0].data || []).slice().sort(function (a, b2) { return new Date(b2.created_at) - new Date(a.created_at); });
            if (category && CATEGORIES.indexOf(category) >= 0) rows = rows.filter(function (p) { return p.category === category; });
            if (q) rows = rows.filter(function (p) { return p.title.toLowerCase().indexOf(q) >= 0 || p.body.toLowerCase().indexOf(q) >= 0; });
            if (query.get('bookmarked') === '1' && bm) rows = rows.filter(function (p) { return bm.has(p.id); });
            var out = rows.map(function (p) { return serializePost(p, bm); });
            if (sort === 'top') out.sort(function (x, y) { return y.score - x.score; });
            else if (sort === 'hot') out.sort(function (x, y) { return hotScore(y.score, y.createdAt) - hotScore(x.score, x.createdAt); });
            out.sort(function (x, y) { return (y.pinned ? 1 : 0) - (x.pinned ? 1 : 0); });
            return json(200, { posts: out, categories: CATEGORIES });
          });
        });
      }
      // create
      if (b._honey) return Promise.resolve(json(200, { ok: true }));
      var title = str(b.title).trim(), body = str(b.body).trim();
      if (title.length < 3 || title.length > 150) return Promise.resolve(fail(400, 'Title must be 3-150 characters.'));
      if (body.length < 1 || body.length > 5000) return Promise.resolve(fail(400, 'Post body must be 1-5000 characters.'));
      return getSession().then(function (s) {
        var name = str(b.name).trim();
        if (!s && (name.length < 1 || name.length > 60)) return fail(400, 'Name must be 1-60 characters.');
        return c.rpc('create_forum_post', { p_name: name, p_title: title, p_body: body, p_category: str(b.category) }).then(function (r) {
          if (r.error) return dbError(r.error);
          return fetchPost(r.data, null, false, null).then(function (p) { return p.post ? json(201, { post: p.post }) : fail(500, 'Could not load the new post.'); });
        });
      });
    }

    if (!action) {
      if (method === 'GET') {
        return getSession().then(function (s) {
          return fetchPost(id, query.get('voterId'), true, s).then(function (p) {
            if (p.error) return dbError(p.error);
            return p.notFound ? fail(404, 'Post not found.') : json(200, { post: p.post });
          });
        });
      }
      if (method === 'PATCH') {
        var patch = {};
        var t = str(b.title).trim(), bd = str(b.body).trim();
        if (t.length >= 3 && t.length <= 150) patch.title = t;
        if (bd.length >= 1 && bd.length <= 5000) patch.body = bd;
        if (CATEGORIES.indexOf(b.category) >= 0) patch.category = b.category;
        var run = Object.keys(patch).length
          ? c.from('forum_posts').update(patch).eq('id', id).select('id') : c.from('forum_posts').select('id').eq('id', id);
        return run.then(function (r) {
          if (r.error) return dbError(r.error);
          if (!r.data || !r.data.length) return fail(403, 'You can only edit your own posts.');
          return fetchPost(id, query.get('voterId'), false, null).then(function (p) { return p.post ? json(200, { post: p.post }) : fail(404, 'Post not found.'); });
        });
      }
      if (method === 'DELETE') {
        return c.from('forum_posts').delete().eq('id', id).select('id').then(function (r) {
          if (r.error) return dbError(r.error);
          if (!r.data || !r.data.length) return fail(403, 'You can only delete your own posts.');
          return json(200, { ok: true });
        });
      }
    }
    if (action === 'pin') {
      return c.rpc('forum_toggle_pin', { p_post: id }).then(function (r) {
        return r.error ? fail(403, 'Admin account required.') : json(200, { ok: true, pinned: !!r.data });
      });
    }
    if (action === 'bookmark') {
      return getSession().then(function (s) {
        if (!s) return fail(401, 'Log in to save posts.');
        return c.from('forum_bookmarks').select('post_id').eq('user_id', s.user.id).eq('post_id', id).maybeSingle().then(function (ex) {
          if (ex.data) {
            return c.from('forum_bookmarks').delete().eq('user_id', s.user.id).eq('post_id', id).then(function () { return json(200, { ok: true, bookmarked: false }); });
          }
          return c.from('forum_bookmarks').insert({ user_id: s.user.id, post_id: id }).then(function (r) {
            return r.error ? fail(404, 'Post not found.') : json(200, { ok: true, bookmarked: true });
          });
        });
      });
    }
    if (action === 'vote') {
      return c.rpc('forum_vote', { p_post: id, p_voter: str(b.voterId), p_vote: str(b.vote) }).then(function (r) {
        if (r.error) return dbError(r.error);
        return getSession().then(function (s) {
          return fetchPost(id, b.voterId, false, s).then(function (p) { return p.post ? json(200, { post: p.post }) : fail(404, 'Post not found.'); });
        });
      });
    }
    return Promise.resolve(fail(404, 'Not found.'));
  }

  // ---------- NOTIFICATIONS ----------
  function notifications(method, parts) {
    return getSession().then(function (s) {
      if (!s) return NOT_LOGGED_IN();
      var c = client();
      if (method === 'GET') {
        return c.from('notifications').select('*').eq('user_id', s.user.id).order('created_at', { ascending: false }).limit(50).then(function (r) {
          if (r.error) return dbError(r.error);
          var list = r.data || [];
          return json(200, {
            notifications: list.map(function (n) { return { id: n.id, type: n.type, message: n.message, link: n.link, read: !!n.read_at, createdAt: fmt(n.created_at) }; }),
            unreadCount: list.filter(function (n) { return !n.read_at; }).length
          });
        });
      }
      var q = c.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', s.user.id);
      q = parts[0] === 'read-all' ? q.is('read_at', null) : q.eq('id', parts[0]);
      return q.then(function () { return json(200, { ok: true }); });
    });
  }

  // ---------- MESSAGES ----------
  function name2(p) { return p ? ((p.first_name || '') + ' ' + (p.last_name || '')).trim() : ''; }
  function msgOut(m, rx, myId) {
    return {
      id: m.id, body: m.body, createdAt: fmt(m.created_at), fromMe: m.sender_id === myId, read: !!m.read_at,
      attachmentUrl: m.attachment_url || null, attachmentName: m.attachment_name || null, attachmentType: m.attachment_type || null,
      reactions: rx || []
    };
  }
  function utcMs(s) { return new Date(String(s).replace(' ', 'T') + 'Z').getTime(); }
  function messages(method, parts, query, b, rawBody) {
    return getSession().then(function (s) {
      if (!s) return NOT_LOGGED_IN();
      var c = client(), me = s.user.id;
      var first = parts[0];

      if (method === 'GET' && first === 'users') {
        var q = (query.get('q') || '').trim().toLowerCase();
        return c.from('profiles').select('id,first_name,last_name').neq('id', me).order('first_name').limit(500).then(function (r) {
          if (r.error) return dbError(r.error);
          var list = (r.data || []).filter(function (u) { return !q || name2(u).toLowerCase().indexOf(q) >= 0; });
          return json(200, { users: list.slice(0, 25).map(function (u) { return { id: u.id, name: name2(u) }; }) });
        });
      }

      if (method === 'GET' && first === 'conversations') {
        return c.from('direct_messages').select('sender_id,recipient_id,body,created_at,read_at,attachment_url')
          .order('created_at', { ascending: false }).limit(1000).then(function (r) {
            if (r.error) return dbError(r.error);
            var byPartner = {};
            (r.data || []).forEach(function (m) {
              var pid = m.sender_id === me ? m.recipient_id : m.sender_id;
              var e = byPartner[pid] || (byPartner[pid] = { last: m, unread: 0 });
              if (m.recipient_id === me && !m.read_at) e.unread++;
            });
            var ids = Object.keys(byPartner);
            if (!ids.length) return json(200, { conversations: [] });
            return c.from('profiles').select('id,first_name,last_name').in('id', ids).then(function (pr) {
              var names = {};
              (pr.data || []).forEach(function (p) { names[p.id] = name2(p); });
              var convos = ids.map(function (pid) {
                var e = byPartner[pid];
                return {
                  userId: pid, name: names[pid] || 'Deleted user',
                  lastMessage: e.last.body || (e.last.attachment_url ? 'Attachment' : ''),
                  lastFromMe: e.last.sender_id === me, lastAt: fmt(e.last.created_at), unreadCount: e.unread
                };
              }).sort(function (a, b2) { return utcMs(b2.lastAt) - utcMs(a.lastAt); });
              return json(200, { conversations: convos });
            });
          });
      }

      if (method === 'GET' && first === 'with') {
        var other = parts[1];
        return c.from('profiles').select('id,first_name,last_name').eq('id', other).maybeSingle().then(function (pr) {
          if (!pr.data) return fail(404, 'User not found.');
          return c.from('direct_messages').update({ read_at: new Date().toISOString() })
            .eq('sender_id', other).eq('recipient_id', me).is('read_at', null).then(function () {
              return c.from('direct_messages').select('*')
                .or('and(sender_id.eq.' + me + ',recipient_id.eq.' + other + '),and(sender_id.eq.' + other + ',recipient_id.eq.' + me + ')')
                .order('created_at', { ascending: true }).then(function (mr) {
                  if (mr.error) return dbError(mr.error);
                  var msgs = mr.data || [];
                  var ids = msgs.map(function (m) { return m.id; });
                  var rp = ids.length ? c.from('message_reactions').select('message_id,user_id,emoji').in('message_id', ids) : Promise.resolve({ data: [] });
                  return rp.then(function (rr) {
                    var by = {};
                    (rr.data || []).forEach(function (x) { (by[x.message_id] = by[x.message_id] || []).push({ emoji: x.emoji, userId: x.user_id, fromMe: x.user_id === me }); });
                    return json(200, { otherUser: { id: pr.data.id, name: name2(pr.data) }, messages: msgs.map(function (m) { return msgOut(m, by[m.id], me); }) });
                  });
                });
            });
        });
      }

      if (method === 'POST' && first === 'upload') {
        var file = rawBody && rawBody.get ? rawBody.get('file') : null;
        var okTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'];
        if (!file || !file.size) return fail(400, 'No file received.');
        if (okTypes.indexOf(file.type) < 0) return fail(400, 'That file type is not supported.');
        if (file.size > 8 * 1024 * 1024) return fail(400, 'File must be 8MB or smaller.');
        var path = me + '/' + rand() + extOf(file.name, '');
        return c.storage.from('message-attachments').upload(path, file, { contentType: file.type }).then(function (u) {
          if (u.error) return fail(400, u.error.message);
          return json(201, { attachmentUrl: c.storage.from('message-attachments').getPublicUrl(path).data.publicUrl, attachmentName: file.name, attachmentType: file.type });
        });
      }

      if (method === 'POST' && !first) {
        var rid = str(b.recipientId), body = str(b.body).trim();
        var hasAtt = typeof b.attachmentUrl === 'string' && /^https?:\/\//.test(b.attachmentUrl);
        if (!rid) return fail(400, 'Invalid recipient.');
        if (rid === me) return fail(400, "You can't message yourself.");
        if (!body && !hasAtt) return fail(400, 'Message must have text or an attachment.');
        if (body.length > 2000) return fail(400, 'Message must be 2000 characters or fewer.');
        return c.from('direct_messages').insert({
          sender_id: me, recipient_id: rid, body: body,
          attachment_url: hasAtt ? b.attachmentUrl : null,
          attachment_name: hasAtt && typeof b.attachmentName === 'string' ? b.attachmentName.slice(0, 200) : null,
          attachment_type: hasAtt && typeof b.attachmentType === 'string' ? b.attachmentType.slice(0, 100) : null
        }).select('*').single().then(function (r) {
          if (r.error) return r.error.code === '23503' ? fail(404, 'That user no longer exists.') : dbError(r.error);
          return json(201, { message: msgOut(r.data, [], me) });
        });
      }

      if (method === 'POST' && parts[1] === 'react') {
        var mid = Number(first), emoji = str(b.emoji).trim();
        if (!Number.isInteger(mid)) return fail(400, 'Invalid message id.');
        if (!emoji || emoji.length > 8) return fail(400, 'Invalid reaction.');
        return c.from('message_reactions').select('emoji').eq('message_id', mid).eq('user_id', me).maybeSingle().then(function (ex) {
          var op = (ex.data && ex.data.emoji === emoji)
            ? c.from('message_reactions').delete().eq('message_id', mid).eq('user_id', me)
            : c.from('message_reactions').upsert({ message_id: mid, user_id: me, emoji: emoji }, { onConflict: 'message_id,user_id' });
          return op.then(function (w) {
            if (w.error) return fail(404, 'Message not found.');
            return c.from('message_reactions').select('user_id,emoji').eq('message_id', mid).then(function (rr) {
              return json(200, { reactions: (rr.data || []).map(function (x) { return { emoji: x.emoji, userId: x.user_id, fromMe: x.user_id === me }; }) });
            });
          });
        });
      }
      return fail(404, 'Not found.');
    });
  }

  // ---------- CONTACT / SUBSCRIBE / ADMIN ----------
  function contact(method, parts, b) {
    var c = client();
    var ADMIN_ERR = 'You need to be logged in with an admin account to do that.';
    if (method === 'POST' && !parts[0]) {
      if (b._honey) return Promise.resolve(json(200, { ok: true, message: 'Message received.' }));
      var f = ['name', 'phone', 'email', 'subject', 'message'].map(function (k) { return str(b[k]).trim(); });
      if (f.some(function (v) { return !v; })) return Promise.resolve(fail(400, 'Please complete every field.'));
      if (!EMAIL_RE.test(f[2])) return Promise.resolve(fail(400, 'Please enter a valid email address.'));
      if (f[0].length > 100 || f[1].length > 50 || f[2].length > 254 || f[3].length > 150 || f[4].length > 5000) return Promise.resolve(fail(400, 'One or more fields are too long.'));
      return c.from('contact_messages').insert({ name: f[0], phone: f[1], email: f[2].toLowerCase(), subject: f[3], message: f[4] }).then(function (r) {
        return r.error ? fail(500, 'Could not send your message. Please try again.') : json(201, { ok: true, message: 'Thanks — your message has been received.' });
      });
    }
    if (method === 'GET') {
      return currentUser(false).then(function (me) {
        if (!me || !me.user.isAdmin) return fail(403, ADMIN_ERR);
        return c.from('contact_messages').select('*').order('created_at', { ascending: false }).then(function (r) {
          if (r.error) return fail(403, ADMIN_ERR);
          return json(200, { messages: r.data.map(function (m) { m.created_at = fmt(m.created_at); m.replied_at = fmt(m.replied_at); return m; }) });
        });
      });
    }
    if (method === 'POST' && parts[1] === 'reply') {
      var id = Number(parts[0]), reply = str(b.replyBody).trim();
      if (!reply || reply.length > 5000) return Promise.resolve(fail(400, 'Reply message is required (max 5000 characters).'));
      return currentUser(false).then(function (me) {
        if (!me || !me.user.isAdmin) return fail(403, ADMIN_ERR);
        return c.from('contact_messages').select('*').eq('id', id).maybeSingle().then(function (o) {
          if (!o.data) return fail(404, 'Message not found.');
          if (o.data.replied_at) {
            return fail(409, (o.data.replied_by || 'Another admin') + ' already replied to this message.',
              { repliedAt: fmt(o.data.replied_at), repliedBy: o.data.replied_by, replyBody: o.data.reply_body });
          }
          var adminName = ((me.user.firstName + ' ' + me.user.lastName).trim()) || me.user.email;
          return c.from('contact_messages').update({ replied_at: new Date().toISOString(), reply_body: reply, replied_by: adminName })
            .eq('id', id).select('id').then(function (u) {
              if (u.error) return dbError(u.error);
              // A static site can't send mail itself, so hand the reply to the admin's mail app.
              var mailto = 'mailto:' + encodeURIComponent(o.data.email) + '?subject=' + encodeURIComponent('Re: ' + o.data.subject) +
                '&body=' + encodeURIComponent(reply + '\n\n---\nYour original message:\n' + o.data.message);
              return json(200, { ok: true, repliedBy: adminName, mailto: mailto });
            });
        });
      });
    }
    return Promise.resolve(fail(404, 'Not found.'));
  }

  function subscribe(b) {
    if (b._honey) return Promise.resolve(json(200, { ok: true }));
    var email = str(b.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return Promise.resolve(fail(400, 'Please enter a valid email address.'));
    return client().from('subscribers').insert({ email: email }).then(function (r) {
      if (!r.error) return json(201, { ok: true, message: 'Subscribed!' });
      if (r.error.code === '23505') return json(200, { ok: true, message: "You're already subscribed!" });
      return fail(500, 'Something went wrong. Please try again.');
    });
  }

  function admin(method, parts) {
    var c = client();
    if (parts[0] !== 'users') return Promise.resolve(fail(404, 'Not found.'));
    if (method === 'GET') {
      return c.rpc('admin_list_users').then(function (r) {
        if (r.error) return fail(403, 'You need to be logged in with an admin account to do that.');
        return json(200, { users: r.data.map(function (u) { return { id: u.id, firstName: u.first_name, lastName: u.last_name, email: u.email, createdAt: fmt(u.created_at), isAdmin: !!u.is_admin }; }) });
      });
    }
    if (method === 'DELETE') {
      return c.rpc('admin_delete_user', { p_id: parts[1] }).then(function (r) { return r.error ? dbError(r.error) : json(200, { ok: true }); });
    }
    return Promise.resolve(fail(404, 'Not found.'));
  }

  // ---------- router ----------
  function parseBody(init) {
    var raw = init && init.body;
    if (raw && typeof FormData !== 'undefined' && raw instanceof FormData) return { b: {}, raw: raw };
    if (typeof raw === 'string' && raw) { try { return { b: JSON.parse(raw) || {}, raw: null }; } catch (e) { /* fallthrough */ } }
    return { b: {}, raw: null };
  }

  function route(url, init) {
    var method = ((init && init.method) || 'GET').toUpperCase();
    var path = url.pathname.replace(/^.*?\/api\//, '').replace(/\/+$/, '');
    var parts = path.split('/').map(decodeURIComponent);
    var area = parts.shift();
    var body = parseBody(init), b = body.b, query = url.searchParams;

    if (!client()) {
      return Promise.resolve(fail(503, configured
        ? 'The database library did not load. Refresh the page.'
        : "The site database isn't connected yet — add your Supabase URL and key in sources/js/supabase-config.js (see supabase/README.md)."));
    }

    switch (area) {
      case 'auth': {
        var a = parts[0];
        if (method === 'POST' && a === 'register') return auth.register(b);
        if (method === 'POST' && a === 'login') return auth.login(b);
        if (method === 'POST' && a === 'logout') return auth.logout();
        if (method === 'GET' && a === 'me') return auth.me();
        if (method === 'PATCH' && a === 'profile') return auth.profile(b);
        if (a === 'avatar' && method === 'POST') return auth.avatarUpload(body.raw && body.raw.get('file'));
        if (a === 'avatar' && method === 'DELETE') return auth.avatarDelete();
        if (method === 'POST' && a === 'change-password') return auth.changePassword(b);
        if (method === 'POST' && a === 'forgot-password') return auth.forgotPassword(b);
        if (method === 'POST' && a === 'reset-password') return auth.resetPassword(b);
        if (method === 'PATCH' && a === 'notification-prefs') return auth.notificationPrefs(b);
        if (method === 'GET' && a === 'sessions') return auth.sessions();
        if (method === 'POST' && a === 'sessions' && parts[1] === 'logout-others') return auth.logoutOthers();
        if (method === 'GET' && a === 'export') return auth.exportData();
        if (method === 'DELETE' && a === 'account') return auth.deleteAccount(b);
        break;
      }
      case 'reactions': return reactions(method, parts[0], query, b);
      case 'comments': return comments(method, parts[0], b);
      case 'forum': return forum(method, parts, query, b);
      case 'notifications': return notifications(method, parts);
      case 'messages': return messages(method, parts, query, b, body.raw);
      case 'contact': return contact(method, parts, b);
      case 'subscribe': return subscribe(b);
      case 'admin': return admin(method, parts);
    }
    return Promise.resolve(fail(404, 'Not found.'));
  }

  // ScottPDF / ScottIMG processing tools talk to the Python services (PDFTools/).
  // Those can't run on a static host. Until SV_SUPABASE.toolsApiBase points at a
  // deployed copy of them, show a clear "coming soon" message instead of a broken request.
  var TOOLS_RE = /\/(api\/v1\/process|scottimg\/api\/process|api\/process)\//;
  var IS_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  function toolsNotice() {
    var msg = 'This tool needs our processing server, which isn’t connected yet — it’s coming soon. Your files were not uploaded anywhere.';
    return json(503, { error: msg, detail: msg });
  }

  if (realFetch) {
    window.fetch = function (input, init) {
      try {
        var raw = typeof input === 'string' ? input : (input && input.url) || String(input);
        var url = new URL(raw, window.location.href);
        if (TOOLS_RE.test(url.pathname) && !IS_LOCAL) {
          var base = (cfg.toolsApiBase || '').replace(/\/+$/, '');
          if (!base) return Promise.resolve(toolsNotice());
          var tail = url.pathname.replace(/^.*?(api\/v1\/process|api\/process)\//, function (m, g) { return g + '/'; });
          var target = base + (/^api\/v1/.test(tail) ? '/' : '/scottimg/') + tail + url.search;
          return realFetch(target, init);
        }
        if (API_RE.test(url.pathname)) {
          return route(url, init).catch(function (err) {
            console.error('[ScottVentures] request failed', err);
            return fail(500, 'Something went wrong. Please try again.');
          });
        }
      } catch (e) { /* not a parseable URL — let the browser deal with it */ }
      return realFetch(input, init);
    };
  }
})();
