import { API_URL } from './config.js';

const GUEST_EXPIRED_KEY = 'blippr_guest_expired';

function isAuthEndpoint(path) {
  return path.startsWith('/api/auth/');
}

function isGuestRecoveryEndpoint(path) {
  return path === '/api/users/me' || path === '/api/auth/guest/upgrade';
}

function handleUnauthorized(path) {
  if (isAuthEndpoint(path)) return;
  localStorage.removeItem('blippr_token');
  sessionStorage.removeItem(GUEST_EXPIRED_KEY);
  window.dispatchEvent(new CustomEvent('blippr:auth-invalid'));
}

function markGuestExpired() {
  sessionStorage.setItem(GUEST_EXPIRED_KEY, 'true');
  window.dispatchEvent(new CustomEvent('blippr:guest-expired'));
}

function isGuestExpired() {
  return sessionStorage.getItem(GUEST_EXPIRED_KEY) === 'true';
}

export function getToken() {
  return localStorage.getItem('blippr_token');
}

export function setToken(token) {
  localStorage.setItem('blippr_token', token);
  sessionStorage.removeItem(GUEST_EXPIRED_KEY);
}

export function getTokenSubject() {
  try {
    const token = getToken();
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.sub || '';
  } catch {
    return '';
  }
}

export async function api(path, options = {}) {
  if (isGuestExpired() && !isGuestRecoveryEndpoint(path) && !isAuthEndpoint(path)) {
    const error = new Error('Guest session expired. Create an account to continue.');
    error.code = 'GUEST_EXPIRED';
    error.body = { ok: false, code: 'GUEST_EXPIRED' };
    markGuestExpired();
    throw error;
  }

  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Authorization: getToken() ? `Bearer ${getToken()}` : '',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Request failed');
    error.code = body.code;
    error.body = body;
    if (res.status === 401) handleUnauthorized(path);
    if (error.code === 'GUEST_EXPIRED') markGuestExpired();
    throw error;
  }
  return body;
}
