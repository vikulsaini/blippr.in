import { API_URL } from './config.js';
import { clearVartaCache } from './cache.js';

const API_HOST_KEY = 'varta_active_api_host';

export async function repairStaleDeploymentCache() {
  const previousHost = localStorage.getItem(API_HOST_KEY);
  if (previousHost === API_URL) return;

  localStorage.setItem(API_HOST_KEY, API_URL);
  clearVartaCache();

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => /workbox|precache|varta/i.test(key))
        .map((key) => caches.delete(key))
    );
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => registration.active?.scriptURL?.endsWith('/sw.js'))
        .map((registration) => registration.update())
    );
  }
}
