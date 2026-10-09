import { useEffect, useState } from 'react';

// Matches the auth pattern the rest of the ScottVentures site uses
// (sources/js/session.js): a bearer token in localStorage, verified
// against /api/auth/me. Signed-out visitors are bounced to the site's
// own login page with a redirect back here once they're in.
const AUTH_API_BASE_URL = window.location.origin;
const AUTH_TOKEN_KEY = 'sv_auth_token';

export default function AuthGuard({ children }) {
  const [status, setStatus] = useState('checking'); // checking | ok | denied

  useEffect(() => {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      redirectToLogin();
      return;
    }
    fetch(`${AUTH_API_BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error('invalid session');
        setStatus('ok');
      })
      .catch(() => {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        redirectToLogin();
      });
  }, []);

  function redirectToLogin() {
    setStatus('denied');
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/Account/login.html?redirect=${redirect}`;
  }

  if (status !== 'ok') {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-soft)' }}>
        {status === 'checking' ? 'Checking your session…' : 'Redirecting to sign in…'}
      </div>
    );
  }

  return children;
}
