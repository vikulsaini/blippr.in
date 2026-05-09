export function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value._id) return normalizeId(value._id);
    if (value.$oid) return value.$oid;
    if (value.toString && value.toString !== Object.prototype.toString) return value.toString();
  }
  return String(value);
}

export function getOtherMember(chat, currentUserId) {
  const myId = normalizeId(currentUserId);
  return chat?.members?.find((member) => normalizeId(member) !== myId);
}

export function getNickname(chat, currentUserId, user) {
  if (!user) return '';
  return chat?.nicknames?.[`${currentUserId}:${user._id}`] || user.name;
}

export function sortChats(chats) {
  return [...chats].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function getMessageSenderId(message) {
  return normalizeId(message?.sender);
}

export function callPreview(call, currentUserId) {
  if (!call) return '';
  const mine = normalizeId(call.caller) === normalizeId(currentUserId);
  const direction = mine ? 'Outgoing' : 'Incoming';
  const status = call.status === 'rejected' ? 'declined' : call.status === 'missed' ? 'missed' : call.status === 'ringing' ? 'ringing' : 'ended';
  return `${direction} ${call.type} call ${status}`;
}
