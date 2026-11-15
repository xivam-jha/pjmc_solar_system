const API = 'https://shivamonline.gt.tc/student/game-api/';
const SESSION_KEY = 'pjmc_game_login';
const PENDING_KEY = 'pjmc_game_login_pending';
let authenticatedStudent = null;

export function getAuthenticatedStudent() { return authenticatedStudent; }
export function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function randomValue() { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
function clearCallback() { history.replaceState(null, '', location.pathname + location.search); }
function profileFromResponse(data) {
  if (!data?.student || !/^\d+$/.test(String(data.student.id)) || typeof data.student.name !== 'string') {
    throw new Error('PJMC server से छात्र की जानकारी नहीं मिली।');
  }
  return { id: String(data.student.id), name: data.student.name };
}
async function request(path, options = {}) {
  const response = await fetch(API + path, {
    ...options, credentials: 'omit', cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('PJMC login उपलब्ध नहीं है। Dashboard से Explore Universe फिर खोलें।');
  }
  return response.json();
}

export async function initializeStudentAuth() {
  const params = new URLSearchParams(location.hash.slice(1));
  authenticatedStudent = null;
  if (params.get('login') === '1') {
    clearCallback();
    sessionStorage.removeItem(SESSION_KEY);
    const verifier = randomValue();
    const state = randomValue();
    const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state, started: Date.now() }));
    const url = new URL('authorize.php', API);
    url.search = new URLSearchParams({ state, code_challenge: challenge, code_challenge_method: 'S256' });
    location.replace(url.href);
    return false;
  }
  if (params.has('code') || params.has('state')) {
    clearCallback();
    const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    sessionStorage.removeItem(PENDING_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (!pending || pending.state !== params.get('state') || Date.now() - pending.started > 300000 ||
        !/^[A-Za-z0-9_-]{43}$/.test(params.get('code') || '')) {
      throw new Error('Login request समाप्त हो गई। PJMC Dashboard से Explore Universe फिर खोलें।');
    }
    const result = await request('exchange.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: params.get('code'), verifier: pending.verifier }),
    });
    const student = profileFromResponse(result);
    if (!/^[A-Za-z0-9_-]{43}$/.test(result.token || '') || !Number.isFinite(result.expires_at)) {
      throw new Error('PJMC login का जवाब अधूरा है।');
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: result.token, expires: result.expires_at }));
    authenticatedStudent = student;
    return true;
  }
  const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  if (!session) return true;
  if (!Number.isFinite(session.expires) || session.expires * 1000 <= Date.now()) {
    sessionStorage.removeItem(SESSION_KEY);
    throw new Error('Game login समाप्त हो गया। PJMC Dashboard से Explore Universe फिर खोलें।');
  }
  const result = await request('profile.php', { headers: { Authorization: `Bearer ${session.token}` } });
  authenticatedStudent = profileFromResponse(result);
  return true;
}
