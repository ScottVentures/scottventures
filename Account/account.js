// -----------------------------------------------------------------
// Account/account.js — wires login.html and register.html to the
// real Backend/ auth API (routes/auth.js). Depends on
// sources/js/session.js being loaded first (for svSetSession).
// -----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
  var loginForm = document.getElementById('loginForm');
  if (loginForm) initLoginForm(loginForm);

  var registerForm = document.getElementById('registerForm');
  if (registerForm) initRegisterForm(registerForm);

  var forgotPasswordForm = document.getElementById('forgotPasswordForm');
  if (forgotPasswordForm) initForgotPasswordForm(forgotPasswordForm);

  var resetPasswordForm = document.getElementById('resetPasswordForm');
  if (resetPasswordForm) initResetPasswordForm(resetPasswordForm);
});

function svShowStatus(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = 'tn-comment-status ' + (type || '');
}

function initLoginForm(form) {
  var statusEl = document.getElementById('loginStatus');
  var submitBtn = document.getElementById('loginSubmit');
  var emailInput = form.querySelector('[name="email"]');
  var passwordInput = form.querySelector('[name="password"]');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var email = emailInput.value.trim();
    var password = passwordInput.value;

    if (!email || !password) {
      svShowStatus(statusEl, 'Enter your email and password.', 'error');
      return;
    }

    submitBtn.disabled = true;
    svShowStatus(statusEl, '', '');

    fetch(AUTH_API_BASE_URL + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok) {
          svSetSession(result.data.token, result.data.user);
          svShowStatus(statusEl, 'Signed in — redirecting…', 'success');
          window.location.href = '../index.html';
        } else {
          svShowStatus(statusEl, result.data.error || 'Could not sign in.', 'error');
        }
      })
      .catch(function () {
        svShowStatus(statusEl, "Couldn't reach the server — the API may not be deployed yet.", 'error');
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });
}

function svShowRegisterSuccess(form, email) {
  var card = document.createElement('div');
  card.className = 'sv-reg-success';
  card.setAttribute('role', 'status');
  var esc = function (t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
  card.innerHTML =
    '<style>.sv-reg-success{text-align:center;padding:8px 4px}' +
    '.sv-reg-success .ico{width:76px;height:76px;border-radius:50%;background:#e8f5ec;color:#1e8e3e;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}' +
    '.sv-reg-success h3{font-weight:700;margin-bottom:10px}' +
    '.sv-reg-success p{color:#555;margin-bottom:6px}' +
    '.sv-reg-success .em{font-weight:600;color:#222;word-break:break-all}' +
    '.sv-reg-success .steps{background:#f5f7fb;border-radius:10px;padding:14px 18px;margin:20px 0;text-align:left;font-size:.92rem;color:#444}' +
    '.sv-reg-success .steps li{margin:4px 0}' +
    '.sv-reg-success .hint{font-size:.82rem;color:#888}</style>' +
    '<div class="ico"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></div>' +
    '<h3>Check your inbox</h3>' +
    '<p>Your account has been created. We sent a confirmation link to</p>' +
    '<p class="em">' + esc(email) + '</p>' +
    '<ol class="steps"><li>Open the email from ScottVentures</li><li>Click <b>Confirm your email</b></li><li>Come back and log in</li></ol>' +
    '<a href="login.html" class="btn btn-primary btn-block mb-3">Go to log in</a>' +
    '<p class="hint">Not there after a minute? Check your spam or promotions folder.</p>';
  form.parentNode.replaceChild(card, form);
  var social = document.querySelector('.sv-social');
  if (social) social.style.display = 'none';
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function initRegisterForm(form) {
  var statusEl = document.getElementById('registerStatus');
  var submitBtn = document.getElementById('registerSubmit');
  var firstNameInput = form.querySelector('[name="firstName"]');
  var lastNameInput = form.querySelector('[name="lastName"]');
  var emailInput = form.querySelector('[name="email"]');
  var passwordInput = form.querySelector('[name="password"]');
  var passwordConfirmInput = form.querySelector('[name="passwordConfirm"]');
  var newsletterCheckbox = document.getElementById('form2Example33');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var firstName = firstNameInput.value.trim();
    var lastName = lastNameInput.value.trim();
    var email = emailInput.value.trim();
    var password = passwordInput.value;
    var passwordConfirm = passwordConfirmInput ? passwordConfirmInput.value : password;

    if (!firstName || !lastName || !email || !password) {
      svShowStatus(statusEl, 'Fill in every field to continue.', 'error');
      return;
    }
    if (password.length < 8) {
      svShowStatus(statusEl, 'Password must be at least 8 characters.', 'error');
      return;
    }
    if (password !== passwordConfirm) {
      svShowStatus(statusEl, 'Passwords do not match.', 'error');
      return;
    }

    submitBtn.disabled = true;
    svShowStatus(statusEl, '', '');

    fetch(AUTH_API_BASE_URL + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: firstName, lastName: lastName, email: email, password: password })
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data.pendingConfirmation) {
          if (newsletterCheckbox && newsletterCheckbox.checked) {
            fetch(AUTH_API_BASE_URL + '/api/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: email })
            }).catch(function () {});
          }
          svShowRegisterSuccess(form, email);
          return;
        }
        if (result.ok) {
          svSetSession(result.data.token, result.data.user);
          svShowStatus(statusEl, 'Account created — redirecting…', 'success');
          // Fire-and-forget: don't block the redirect on this, and
          // don't surface a failure here — newsletter signup is a
          // nice-to-have, not part of account creation succeeding.
          if (newsletterCheckbox && newsletterCheckbox.checked) {
            fetch(AUTH_API_BASE_URL + '/api/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: email })
            }).catch(function () {});
          }
          window.location.href = '../index.html';
        } else {
          svShowStatus(statusEl, result.data.error || 'Could not create account.', 'error');
        }
      })
      .catch(function () {
        svShowStatus(statusEl, "Couldn't reach the server — the API may not be deployed yet.", 'error');
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });
}

/* ---------------- Forgot password ---------------- */
function initForgotPasswordForm(form) {
  var statusEl = document.getElementById('forgotPasswordStatus');
  var submitBtn = document.getElementById('forgotPasswordSubmit');
  var emailInput = form.querySelector('[name="email"]');
  var linkWrap = document.getElementById('forgotPasswordLinkWrap');
  var linkEl = document.getElementById('forgotPasswordLink');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var email = emailInput.value.trim();
    if (!email) {
      svShowStatus(statusEl, 'Enter your email address.', 'error');
      return;
    }

    submitBtn.disabled = true;
    if (linkWrap) linkWrap.style.display = 'none';
    svShowStatus(statusEl, '', '');

    fetch(AUTH_API_BASE_URL + '/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok) {
          svShowStatus(statusEl, result.data.message || 'If that email exists, a reset link was sent.', 'success');
          // If email isn't configured on the backend yet, the API
          // falls back to handing the link back directly (see
          // Backend/routes/auth.js) so the flow still works for local
          // testing. Once SMTP is set up, resetUrl won't be present
          // and this link just won't show — the person gets a real
          // email instead.
          if (result.data.resetUrl && linkWrap && linkEl) {
            linkEl.setAttribute('href', result.data.resetUrl);
            linkWrap.style.display = 'block';
          }
        } else {
          svShowStatus(statusEl, result.data.error || 'Could not process that request.', 'error');
        }
      })
      .catch(function () {
        svShowStatus(statusEl, "Couldn't reach the server — the API may not be deployed yet.", 'error');
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });
}

/* ---------------- Reset password ---------------- */
function initResetPasswordForm(form) {
  var statusEl = document.getElementById('resetPasswordStatus');
  var submitBtn = document.getElementById('resetPasswordSubmit');
  var passwordInput = form.querySelector('[name="password"]');
  var confirmInput = form.querySelector('[name="passwordConfirm"]');

  var params = new URLSearchParams(window.location.search);
  var token = params.get('token');

  if (!token) {
    svShowStatus(statusEl, 'This reset link is missing its token — request a new one from the "Forgot password?" page.', 'error');
    submitBtn.disabled = true;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var password = passwordInput.value;
    var confirm = confirmInput.value;

    if (!password || password.length < 8) {
      svShowStatus(statusEl, 'Password must be at least 8 characters.', 'error');
      return;
    }
    if (password !== confirm) {
      svShowStatus(statusEl, 'Passwords do not match.', 'error');
      return;
    }

    submitBtn.disabled = true;
    svShowStatus(statusEl, '', '');

    fetch(AUTH_API_BASE_URL + '/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, password: password })
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok) {
          svShowStatus(statusEl, 'Password updated — redirecting to login…', 'success');
          form.reset();
          submitBtn.disabled = true;
          setTimeout(function () {
            window.location.href = 'login.html';
          }, 1500);
        } else {
          svShowStatus(statusEl, result.data.error || 'Could not reset password.', 'error');
          submitBtn.disabled = false;
        }
      })
      .catch(function () {
        svShowStatus(statusEl, "Couldn't reach the server — the API may not be deployed yet.", 'error');
        submitBtn.disabled = false;
      });
  });
}
