import { getToken } from './api.js';
import { createSocket } from './socket.js';

let socket;

export function getRealtimeSocket() {
  const currentToken = getToken();
  if (socket && socket.auth?.token !== currentToken) {
    console.log('[Realtime] Token changed or expired. Disconnecting old socket connection.');
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    console.log('[Realtime] Initializing new socket instance.');
    socket = createSocket();
  }
  socket.auth = { token: currentToken };
  
  if (currentToken) {
    if (!socket.connected) {
      console.log('[Realtime] Socket is not connected. Connecting now...');
      socket.connect();
    }
  } else {
    console.log('[Realtime] Skipping socket connection: No active token found.');
    if (socket.connected) {
      socket.disconnect();
    }
  }
  return socket;
}

