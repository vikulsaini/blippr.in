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
  const getSortDateString = (c) => {
    return c.lastMessage?.createdAt || c.createdAt || '1970-01-01T00:00:00.000Z';
  };
  return [...chats].sort((a, b) => {
    const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinDiff !== 0) return pinDiff;
    const dateA = getSortDateString(a);
    const dateB = getSortDateString(b);
    if (dateA < dateB) return 1;
    if (dateA > dateB) return -1;
    return 0;
  });
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
