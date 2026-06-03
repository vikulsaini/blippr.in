import { io } from 'socket.io-client';
import { getToken } from './api';
import { SOCKET_URL } from './config.js';

export function createSocket() {
  const socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: { token: getToken() },
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1200,
    reconnectionDelayMax: 6000,
    timeout: 20000
  });

  socket.on('connect', () => window.dispatchEvent(new CustomEvent('varta:socket-state', { detail: { state: 'connected' } })));
  socket.io.on('reconnect_attempt', () => window.dispatchEvent(new CustomEvent('varta:socket-state', { detail: { state: 'connecting' } })));
  socket.io.on('reconnect', () => window.dispatchEvent(new CustomEvent('varta:socket-state', { detail: { state: 'reconnected' } })));
  socket.on('disconnect', () => window.dispatchEvent(new CustomEvent('varta:socket-state', { detail: { state: 'connecting' } })));

  return socket;
}
