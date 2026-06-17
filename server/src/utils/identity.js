import { nanoid } from 'nanoid';
import User from '../models/User.js';

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 18);
}

export function avatarForGender(gender, seed) {
  const style = gender === 'female' ? 'avataaars' : 'adventurer';
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear`;
}

export async function createUniqueUsername(name = 'blippr') {
  const base = slugify(name) || 'blippr';

  for (let index = 0; index < 8; index += 1) {
    const suffix = nanoid(5).toLowerCase().replace(/[^a-z0-9]/g, '');
    const username = `${base}_${suffix}`;
    const exists = await User.exists({ username });
    if (!exists) return username;
  }

  return `blippr_${nanoid(10).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

export async function guestIdentity(gender) {
  const code = nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, '');
  const username = await createUniqueUsername(`guest_${code}`);
  return {
    name: `Guest ${code.slice(0, 4).toUpperCase()}`,
    username,
    avatar: avatarForGender(gender, username)
  };
}
