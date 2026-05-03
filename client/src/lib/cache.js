const PREFIX = 'varta_cache';
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000;

function key(name, userId = 'global') {
  return `${PREFIX}:${userId}:${name}`;
}

export function readCache(name, userId, fallback = null) {
  try {
    const raw = localStorage.getItem(key(name, userId));
    if (!raw) return fallback;
    const item = JSON.parse(raw);
    if (item.expiresAt && item.expiresAt < Date.now()) {
      localStorage.removeItem(key(name, userId));
      return fallback;
    }
    return item.value ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeCache(name, value, userId, ttl = DEFAULT_TTL) {
  try {
    localStorage.setItem(
      key(name, userId),
      JSON.stringify({
        value,
        expiresAt: Date.now() + ttl
      })
    );
  } catch {
    // Cache is best-effort only.
  }
}

export function clearVartaCache() {
  Object.keys(localStorage)
    .filter((itemKey) => itemKey.startsWith(`${PREFIX}:`))
    .forEach((itemKey) => localStorage.removeItem(itemKey));
}
