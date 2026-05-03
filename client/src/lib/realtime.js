import { createSocket } from './socket.js';

let socket;

export function getRealtimeSocket() {
  if (!socket) socket = createSocket();
  if (!socket.connected) socket.connect();
  return socket;
}
