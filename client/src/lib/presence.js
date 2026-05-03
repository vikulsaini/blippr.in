export function presenceText(user) {
  if (!user) return '';
  if (user.isOnline) return 'Active now';
  if (!user.lastSeenAt) return 'Offline';

  const diffMs = Date.now() - new Date(user.lastSeenAt).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));

  if (minutes < 60) return `Last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Last seen ${days}d ago`;
}
