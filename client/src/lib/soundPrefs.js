const STORAGE_KEY = 'varta_sound_preferences';

export const soundPack = [
  { id: 'pulse', name: 'Pulse', kind: 'tone' },
  { id: 'glass', name: 'Glass', kind: 'tone' },
  { id: 'soft', name: 'Soft', kind: 'tone' },
  { id: 'classic', name: 'Classic', kind: 'tone' }
];

const defaultPrefs = {
  ringtone: { type: 'pack', id: 'pulse', name: 'Pulse' },
  messageTone: { type: 'pack', id: 'glass', name: 'Glass' },
  friendRingtones: {},
  dnd: false
};

export function loadSoundPrefs() {
  try {
    return { ...defaultPrefs, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')) };
  } catch {
    return defaultPrefs;
  }
}

export function saveSoundPrefs(nextPrefs) {
  const prefs = { ...loadSoundPrefs(), ...nextPrefs };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent('varta:sound-prefs', { detail: prefs }));
  return prefs;
}

export function setSoundPreference(key, value) {
  return saveSoundPrefs({ [key]: value });
}

export function setFriendRingtone(friendId, value) {
  const prefs = loadSoundPrefs();
  const friendRingtones = { ...(prefs.friendRingtones || {}) };
  if (value) friendRingtones[friendId] = value;
  else delete friendRingtones[friendId];
  return saveSoundPrefs({ friendRingtones });
}

export function getRingtoneForFriend(friendId) {
  const prefs = loadSoundPrefs();
  return prefs.friendRingtones?.[friendId] || prefs.ringtone;
}

export function mediaToSound(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('audio/')) {
      reject(new Error('Choose an audio file'));
      return;
    }
    if (file.size > 900 * 1024) {
      reject(new Error('Use an audio file smaller than 900 KB'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read audio file'));
    reader.onload = () => resolve({ type: 'custom', name: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);
  });
}

export function packSound(id) {
  const item = soundPack.find((sound) => sound.id === id) || soundPack[0];
  return { type: 'pack', id: item.id, name: item.name };
}
