const DEFAULT_API_URL = import.meta.env.PROD ? 'https://varta-api-2k6p.onrender.com' : 'http://localhost:8080';

function normalizeServerUrl(value) {
  const normalized = (value || DEFAULT_API_URL).trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  try {
    new URL(normalized);
  } catch {
    return DEFAULT_API_URL;
  }
  return normalized;
}

export const API_URL = normalizeServerUrl(import.meta.env.VITE_API_URL);
export const SOCKET_URL = normalizeServerUrl(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL);
