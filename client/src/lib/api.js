import { API_URL } from './config.js';

export function getToken() {
  return localStorage.getItem('varta_token');
}

export function setToken(token) {
  localStorage.setItem('varta_token', token);
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
    if (error.code === 'GUEST_EXPIRED') window.dispatchEvent(new CustomEvent('varta:guest-expired'));
    throw error;
  }
  return body;
}
