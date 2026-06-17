const DEFAULT_API_URL = import.meta.env.PROD ? 'https://blippr-api-2k6p.onrender.com' : 'http://localhost:8080';
const RETIRED_BACKEND_HOSTS = new Set(['server-zeta-one-69.vercel.app']);

function normalizeServerUrl(value) {
  const normalized = (value || DEFAULT_API_URL).trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  try {
    const url = new URL(normalized);
    if (import.meta.env.PROD && RETIRED_BACKEND_HOSTS.has(url.hostname)) return DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
  return normalized;
}

export const API_URL = normalizeServerUrl(import.meta.env.VITE_API_URL);
export const SOCKET_URL = normalizeServerUrl(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL);
