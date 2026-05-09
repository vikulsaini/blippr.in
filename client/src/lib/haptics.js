export function haptic(pattern = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Haptics are best-effort only.
  }
}

export const haptics = {
  tap: () => haptic(8),
  select: () => haptic([12, 30, 12]),
  success: () => haptic([20, 40, 20]),
  warning: () => haptic([35, 40, 35])
};
