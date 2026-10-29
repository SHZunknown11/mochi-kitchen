// Fetch wrapper: attaches the access token and quietly swaps it for a new one when it expires.

const KEY = 'mochi.session';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const session = {
  read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
  },
  write(value) {
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* private mode: stay logged in for this tab only */ memory = value; }
  },
  clear() {
    memory = null;
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  },
};
let memory = null;
const current = () => session.read() || memory;

let refreshing = null;
async function refreshTokens() {
  const s = current();
  if (!s || !s.refreshToken) return false;
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: s.refreshToken }),
    }).then(async (res) => {
      if (!res.ok) return false;
      const data = await res.json();
      session.write({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    }).catch(() => false).finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function request(method, path, body, retry = true) {
  const s = current();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(s && s.accessToken ? { Authorization: `Bearer ${s.accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is it running?');
  }

  // /auth/me must be allowed to refresh: it is the first call after a page load, when the 15-minute access token has often expired.
  const isCredentialCall = /^\/auth\/(login|register|refresh|logout)\b/.test(path);
  if (res.status === 401 && retry && s && s.refreshToken && !isCredentialCall) {
    if (await refreshTokens()) return request(method, path, body, false);
    session.clear();
    window.dispatchEvent(new Event('mochi:logout'));
  }
  if (res.status === 204) return null;

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new ApiError(res.status, (data && data.error && data.error.message) || 'Something went wrong.');
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};

export async function login(identifier, password) {
  const data = await request('POST', '/auth/login', { identifier, password });
  session.write({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.user;
}

export async function register(username, email, password) {
  const data = await request('POST', '/auth/register', { username, email, password });
  session.write({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.user;
}

export async function logout() {
  const s = current();
  if (s && s.refreshToken) {
    try { await request('POST', '/auth/logout', { refreshToken: s.refreshToken }); } catch { /* already gone */ }
  }
  session.clear();
}

export const hasSession = () => Boolean(current() && current().accessToken);
