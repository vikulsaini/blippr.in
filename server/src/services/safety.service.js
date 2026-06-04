const restrictedTextPatterns = [
  /\b(?:porn|porno|xxx|nude|nudes|nudity|sex|sexting)\b/i,
  /\b(?:abuse|harass|harassment|threat|threaten)\b/i
];

export function assertTextAllowed(text = '') {
  const value = String(text || '');
  if (!value.trim()) return;
  if (restrictedTextPatterns.some((pattern) => pattern.test(value))) {
    const error = new Error('This message violates Varta safety rules');
    error.status = 400;
    throw error;
  }
}

export function applyBlockedWords(text = '', blockedWords = []) {
  assertTextAllowed(text);
  return blockedWords.reduce((value, word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped ? value.replace(new RegExp(escaped, 'gi'), '***') : value;
  }, text);
}
