// Centralized authentication fetch helper
// Ensures credentials: 'include' is passed to send secure HttpOnly cookies across origins
// and attaches Authorization header only when a valid token is present

export function authFetch(url, options = {}, token = '') {
  const opts = { ...options };
  opts.credentials = 'include';
  opts.headers = { ...(opts.headers || {}) };

  // Only attach Bearer if token is a real JWT string (not placeholder 'cookie_authenticated')
  if (token && token !== 'cookie_authenticated') {
    opts.headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, opts);
}

export function fmtInr(val) {
  if (val === null || val === undefined || val === '') return '0';
  const num = Number(val);
  return Number.isFinite(num) ? num.toLocaleString('en-IN') : '0';
}
