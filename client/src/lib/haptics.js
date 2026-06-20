import { nativeHaptic } from './native.js';

export function haptic(pattern = 12) {
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  nativeHaptic(Array.isArray(pattern) ? 'select' : 'tap').then((handled) => {
    if (handled) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Haptics are best-effort only.
    }
  });
}

function namedHaptic(kind, fallback) {
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  nativeHaptic(kind).then((handled) => {
    if (handled) return;
    try {
      navigator.vibrate?.(fallback);
    } catch {
      // Haptics are best-effort only.
    }
  });
}

export const haptics = {
  tap: () => namedHaptic('tap', 8),
  select: () => namedHaptic('select', [12, 30, 12]),
  success: () => namedHaptic('success', [20, 40, 20]),
  warning: () => namedHaptic('warning', [35, 40, 35])
};
