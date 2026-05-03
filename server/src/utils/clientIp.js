export function getClientIp(reqOrSocket) {
  const headers = reqOrSocket.headers || reqOrSocket.handshake?.headers || {};
  const forwardedFor = headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0];
  return (rawIp || reqOrSocket.ip || reqOrSocket.handshake?.address || reqOrSocket.socket?.remoteAddress || '')
    .replace(/^::ffff:/, '')
    .trim();
}
