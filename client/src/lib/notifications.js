import { api, getToken } from './api.js';
import { isNativeApp, requestNativeNotificationPermission } from './native.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function enablePushNotifications() {
  if (isNativeApp()) {
    const allowed = await requestNativeNotificationPermission();
    if (!allowed) throw new Error('Notification permission was not granted');
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (isNativeApp()) return { native: true };
    throw new Error('Push notifications are not supported in this browser');
  }

  const { publicKey } = await api('/api/notifications/public-key');
  if (!publicKey) throw new Error('Push notifications are not configured on the server');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted');

  return subscribeDevice(publicKey);
}

export async function refreshPushSubscriptionIfAllowed() {
  if (!getToken()) return null;
  if (isNativeApp()) requestNativeNotificationPermission().catch(() => {});
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const { publicKey } = await api('/api/notifications/public-key');
  if (!publicKey) return null;

  return subscribeDevice(publicKey);
}

async function subscribeDevice(publicKey) {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    }));

  await api('/api/notifications/subscriptions', {
    method: 'POST',
    body: JSON.stringify(subscription)
  });

  return subscription;
}
