import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export async function initNativeApp() {
  if (!isNativeApp()) return;

  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Dark }),
    StatusBar.setBackgroundColor({ color: '#08090d' }),
    SplashScreen.hide()
  ]);

  App.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(new CustomEvent('varta:native-app-state', { detail: { isActive } }));
  });

  Network.addListener('networkStatusChange', (status) => {
    window.dispatchEvent(new CustomEvent('varta:native-network', { detail: status }));
  });
}

export async function nativeHaptic(kind = 'tap') {
  if (!isNativeApp()) return false;
  try {
    if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
    else if (kind === 'warning') await Haptics.notification({ type: NotificationType.Warning });
    else await Haptics.impact({ style: kind === 'select' ? ImpactStyle.Medium : ImpactStyle.Light });
    return true;
  } catch {
    return false;
  }
}

export async function requestNativeNotificationPermission() {
  if (!isNativeApp()) return false;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;
  const next = await LocalNotifications.requestPermissions();
  return next.display === 'granted';
}

export async function showNativeNotification({ title, body, id, extra } = {}) {
  if (!isNativeApp()) return false;
  const allowed = await requestNativeNotificationPermission();
  if (!allowed) return false;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: id || Date.now(),
        title: title || 'Varta',
        body: body || '',
        schedule: { at: new Date(Date.now() + 100) },
        extra
      }
    ]
  });
  return true;
}

export async function nativePreferenceGet(key) {
  if (!isNativeApp()) return null;
  const { value } = await Preferences.get({ key });
  return value;
}

export async function nativePreferenceSet(key, value) {
  if (!isNativeApp()) return false;
  await Preferences.set({ key, value: String(value) });
  return true;
}
