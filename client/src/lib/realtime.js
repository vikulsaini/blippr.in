import { createSocket } from './socket.js';

let socket;

export function getRealtimeSocket() {
  const currentToken = localStorage.getItem('blippr_token');
  if (socket && socket.auth?.token !== currentToken) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    socket = createSocket();
  }
  socket.auth = { token: currentToken };
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}
