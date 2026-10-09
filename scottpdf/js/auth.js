// scottpdf/js/auth.js — connects login.html / register.html to the
// real Backend/ auth API (Backend/routes/auth.js), and keeps the
// header Login/Sign up links in sync with whether the visitor is
// already signed in. Uses the same localStorage keys as the main
// ScottVentures site (sources/js/session.js) so a session carries
// over between the main site and the ScottPDF tools.
(function () {
  var TOKEN_KEY = 'sv_auth_token';
  var USER_KEY = 'sv_auth_user';

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }
  function setSession(token, user) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) { /* storage unavailable — session still works for this page load */ }
  }
  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) { /* ignore */ }
  }

  function showStatus(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.className = 'auth-status' + (type ? ' ' + type : '');
  }

  // ---- header sync: swap "Login"/"Sign up" for a greeting + log out ----
  function syncHeader() {
    var token = getToken();
    var loginLink = document.querySelector('.login-link');
    var signupLink = document.querySelector('.signup-link');
    if (!token || !loginLink || !signupLink) return;

    fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) { if (!r.ok) throw new Error('invalid session'); return r.json(); })
      .then(function (data) {
        var user = data.user;
        loginLink.textContent = 'Hi, ' + user.firstName;
        loginLink.setAttribute('href', '../Account/settings.html');
        signupLink.textContent = 'Log out';
        signupLink.setAttribute('href', '#');
        signupLink.addEventListener('click', function (e) {
          e.preventDefault();
          fetch('/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token }
          }).catch(function () {});
          clearSession();
          window.location.reload();
        });
      })
      .catch(function () {
        // Token expired or invalid — quietly drop it so the header
        // goes back to showing Login/Sign up.
        clearSession();
      });
  }

  // ---- login.html ----
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
        showStatus(statusEl, 'Enter your email and password.', 'error');
        return;
      }
      submitBtn.disabled = true;
      showStatus(statusEl, '', '');
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (result) {
          if (result.ok) {
            setSession(result.data.token, result.data.user);
            showStatus(statusEl, 'Signed in — redirecting…', 'success');
            var params = new URLSearchParams(window.location.search);
            window.location.href = params.get('redirect') || './index.html';
          } else {
            showStatus(statusEl, result.data.error || 'Could not sign in.', 'error');
          }
        })
        .catch(function () {
          showStatus(statusEl, "Couldn't reach the server — try again in a moment.", 'error');
        })
        .finally(function () {
          submitBtn.disabled = false;
        });
    });
  }

  // ---- register.html ----
  function initRegisterForm(form) {
    var statusEl = document.getElementById('registerStatus');
    var submitBtn = document.getElementById('registerSubmit');
    var firstNameInput = form.querySelector('[name="firstName"]');
    var lastNameInput = form.querySelector('[name="lastName"]');
    var emailInput = form.querySelector('[name="email"]');
    var passwordInput = form.querySelector('[name="password"]');
    var passwordConfirmInput = form.querySelector('[name="passwordConfirm"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstName = firstNameInput.value.trim();
      var lastName = lastNameInput.value.trim();
      var email = emailInput.value.trim();
      var password = passwordInput.value;
      var passwordConfirm = passwordConfirmInput ? passwordConfirmInput.value : password;

      if (!firstName || !lastName || !email || !password) {
        showStatus(statusEl, 'Fill in every field to continue.', 'error');
        return;
      }
      if (password.length < 8) {
        showStatus(statusEl, 'Password must be at least 8 characters.', 'error');
        return;
      }
      if (password !== passwordConfirm) {
        showStatus(statusEl, 'Passwords do not match.', 'error');
        return;
      }

      submitBtn.disabled = true;
      showStatus(statusEl, '', '');
      fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName, lastName: lastName, email: email, password: password })
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (result) {
          if (result.ok) {
            setSession(result.data.token, result.data.user);
            showStatus(statusEl, 'Account created — redirecting…', 'success');
            window.location.href = './index.html';
          } else {
            showStatus(statusEl, result.data.error || 'Could not create account.', 'error');
          }
        })
        .catch(function () {
          showStatus(statusEl, "Couldn't reach the server — try again in a moment.", 'error');
        })
        .finally(function () {
          submitBtn.disabled = false;
        });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncHeader();
    var loginForm = document.getElementById('loginForm');
    if (loginForm) initLoginForm(loginForm);
    var registerForm = document.getElementById('registerForm');
    if (registerForm) initRegisterForm(registerForm);
  });
})();
