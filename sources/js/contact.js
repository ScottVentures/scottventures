document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('contact');
  if (!form) return;

  var status = document.getElementById('contactStatus');
  var submit = document.getElementById('form-submit');
  // Same convention as Articles/articles.js and sources/js/session.js:
  // Backend/server.js now serves this whole site as static files
  // alongside the API (see server.js), so the page and the API share
  // one origin whenever the site is run the intended way (npm start,
  // then browse http://localhost:4000). The localhost fallback below
  // only matters for a direct file:// preview with no server at all.
  var CONTACT_API_BASE_URL = window.location.protocol === 'http:' || window.location.protocol === 'https:'
    ? window.location.origin
    : 'http://localhost:4000';

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Sending…';
    status.textContent = '';
    status.className = 'tn-comment-status';

    var data = Object.fromEntries(new FormData(form).entries());
    fetch(CONTACT_API_BASE_URL + '/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (response) {
        return response.json().then(function (body) { return { ok: response.ok, body: body }; });
      })
      .then(function (result) {
        status.textContent = result.body.message || result.body.error || 'Could not send your message.';
        status.className = 'tn-comment-status ' + (result.ok ? 'success' : 'error');
        if (result.ok) form.reset();
      })
      .catch(function () {
        status.textContent = "Couldn't reach the server. Please try again.";
        status.className = 'tn-comment-status error';
      })
      .finally(function () {
        submit.disabled = false;
        submit.textContent = 'Send Message';
      });
  });
});
