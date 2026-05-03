const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: getToken() ? `Bearer ${getToken()}` : '',
      ...options.headers
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || 'Request failed');
  return body;
}
