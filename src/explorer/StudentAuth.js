const DASHBOARD_ORIGIN = 'https://shivamonline.gt.tc';
const BRIDGE_URL = DASHBOARD_ORIGIN + '/student/explore-universe.php';
let authenticatedStudent = null;

export function getAuthenticatedStudent() { return authenticatedStudent; }
export function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function profileFromResponse(data) {
  if (!data?.student || !/^[1-9]\d*$/.test(String(data.student.id)) ||
      typeof data.student.name !== 'string' || !data.student.name.trim()) {
    throw new Error('PJMC server से छात्र की जानकारी नहीं मिली।');
  }
  return { id: String(data.student.id), name: data.student.name };
}

// The first-party dashboard page authenticates its PHP session. Only that
// exact parent window and origin may supply a profile; URL names are ignored.
export function receiveDashboardProfile(host = window, timeoutMs = 15000) {
  if (host.parent === host) return Promise.reject(new Error('PJMC Dashboard से Explore Universe खोलें।'));
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(32)));
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); host.removeEventListener('message', onMessage); };
    const onMessage = event => {
      if (event.origin !== DASHBOARD_ORIGIN || event.source !== host.parent ||
          event.data?.type !== 'pjmc:student' || event.data.nonce !== nonce) return;
      cleanup();
      try { resolve(profileFromResponse(event.data)); } catch (error) { reject(error); }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Dashboard से पहचान नहीं मिली। Dashboard में वापस जाकर गेम फिर खोलें।'));
    }, timeoutMs);
    host.addEventListener('message', onMessage);
    host.parent.postMessage({ type: 'pjmc:ready', nonce }, DASHBOARD_ORIGIN);
  });
}

export async function initializeStudentAuth() {
  const params = new URLSearchParams(location.hash.slice(1));
  authenticatedStudent = null;
  if (params.get('pjmc') === 'bridge') {
    // Keep this non-secret marker so iframe reload repeats the handshake.
    authenticatedStudent = await receiveDashboardProfile();
    return true;
  }
  let legacySession = false;
  try {
    legacySession = !!sessionStorage.getItem('pjmc_game_login');
    sessionStorage.removeItem('pjmc_game_login');
    sessionStorage.removeItem('pjmc_game_login_pending');
  } catch { /* Some browsers restrict storage in embedded contexts. */ }
  if (params.get('login') === '1' || params.has('code') || params.has('state') || legacySession) {
    history.replaceState(null, '', location.pathname + location.search);
    location.replace(BRIDGE_URL);
    return false;
  }
  return true; // A direct public visit remains a guest; never infer an account.
}

export function requestStudentRecords(action, payload = {}, host = window, timeoutMs = 12000) {
  if (host.parent === host) return Promise.reject(new Error('Dashboard से गेम खोलें।'));
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(32)));
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); host.removeEventListener('message', receive); };
    const receive = event => {
      if (event.origin !== DASHBOARD_ORIGIN || event.source !== host.parent ||
          event.data?.type !== 'pjmc:records-result' || event.data.nonce !== nonce) return;
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result);
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Online record अभी उपलब्ध नहीं है।')); }, timeoutMs);
    host.addEventListener('message', receive);
    host.parent.postMessage({ type: 'pjmc:records', nonce, action, ...payload }, DASHBOARD_ORIGIN);
  });
}
