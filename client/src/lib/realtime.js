import { createSocket } from './socket.js';

let socket;

export function getRealtimeSocket() {
  if (!socket) socket = createSocket();
  socket.auth = { token: localStorage.getItem('blippr_token') };
  if (!socket.connected) socket.connect();
  return socket;
}
