import User from '../models/User.js';

const restrictedTextPatterns = [
  /\b(?:porn|porno|xxx|nude|nudes|nudity|sex|sexting)\b/i,
  /\b(?:abuse|harass|harassment|threat|threaten)\b/i
];

export function assertTextAllowed(text = '') {
  const value = String(text || '');
  if (!value.trim()) return;
  
  if (value.length > 5000) {
    const error = new Error('Message is too long for safety evaluation');
    error.status = 400;
    error.code = 'SAFETY_PAYLOAD_TOO_LARGE';
    throw error;
  }

  if (restrictedTextPatterns.some((pattern) => pattern.test(value))) {
    const error = new Error('This message violates Blippr safety rules');
    error.status = 400;
    error.code = 'SAFETY_VIOLATION';
    throw error;
  }
}

export async function recordSafetyViolation(userId) {
  const current = await User.findById(userId).select('safetyViolationCount bannedUntil');
  if (!current) return null;
  const nextCount = (current.safetyViolationCount || 0) + 1;
  current.safetyViolationCount = nextCount;
  if (nextCount >= 3) {
    current.bannedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  await current.save();
  return current;
}

export function applyBlockedWords(text = '', blockedWords = []) {
  assertTextAllowed(text);
  return blockedWords.reduce((value, word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped ? value.replace(new RegExp(escaped, 'gi'), '***') : value;
  }, text);
}
