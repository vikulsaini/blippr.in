self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Blippr', {
      body: data.body || 'New activity on Blippr',
      icon: data.icon || '/favicon.svg',
      badge: data.badge || '/favicon.svg',
      silent: false,
      renotify: data.type === 'call',
      requireInteraction: data.type === 'call',
      tag: data.type === 'call' ? `blippr-call-${data.callId || Date.now()}` : undefined,
      vibrate: data.type === 'call' ? [520, 240, 520, 240, 850] : [120, 80, 120],
      actions: data.type === 'call' ? [{ action: 'open', title: 'Open Blippr' }] : [],
      data: { url: data.url || '/', ...data }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
