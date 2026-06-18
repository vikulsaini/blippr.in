import { API_URL } from './config.js';
import { clearBlipprCache } from './cache.js';

const API_HOST_KEY = 'blippr_active_api_host';

export async function repairStaleDeploymentCache() {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        const scriptURL = registration.active?.scriptURL || '';
        if (scriptURL.endsWith('/notification-sw.js')) {
          await registration.unregister();
          window.location.reload();
          return;
        }
      }
    } catch (err) {
      console.warn('SW cleanup failed:', err);
    }
  }

  const previousHost = localStorage.getItem(API_HOST_KEY);
  if (previousHost === API_URL) return;

  localStorage.setItem(API_HOST_KEY, API_URL);
  clearBlipprCache();

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => /workbox|precache|blippr/i.test(key))
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
