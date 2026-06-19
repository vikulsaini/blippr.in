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
  localStorage.removeItem('blippr_is_guest');
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

export function setToken(token, isGuest = false) {
  localStorage.setItem('blippr_token', token);
  if (isGuest) {
    localStorage.setItem('blippr_is_guest', 'true');
  } else {
    localStorage.removeItem('blippr_is_guest');
  }
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
    error.status = res.status;
    if (res.status === 401) handleUnauthorized(path);
    if (error.code === 'GUEST_EXPIRED') markGuestExpired();
    throw error;
  }
  return body;
}

export const checkAppConfig = () => api('/api/config/app');

// Admin
export const claimAdmin = (secret) => api('/api/admin/claim', { method: 'POST', body: JSON.stringify({ secret }) });
export const getAdminStats = () => api('/api/admin/stats');
export const searchAdminUsers = (q) => api(`/api/admin/users?q=${encodeURIComponent(q || '')}`);
export const updateAdminUserStatus = (id, action, value) => api(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ action, value }) });
export const sendAdminBroadcast = (message) => api('/api/admin/broadcast', { method: 'POST', body: JSON.stringify({ message }) });
export const getAdminMetrics = () => api('/api/admin/metrics');
export const getAdminDbStats = () => api('/api/admin/db/stats');
export const runAdminDbQuery = (body) => api('/api/admin/db/query', { method: 'POST', body: JSON.stringify(body) });
export const getAdminSlowQueries = () => api('/api/admin/db/slow');
export const getAdminFiles = (type) => api(`/api/admin/files?type=${type || 'all'}`);
export const deleteAdminFile = (id, provider) => api(`/api/admin/files/${id}?provider=${provider}`, { method: 'DELETE' });
export const getAdminFileStats = () => api('/api/admin/files/stats');
export const revokeAdminUserSessions = (id) => api(`/api/admin/users/${id}/revoke`, { method: 'POST' });
export const getAdminAuditLogs = () => api('/api/admin/audit-logs');
