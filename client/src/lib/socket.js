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
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected successfully with ID:', socket.id);
    window.dispatchEvent(new CustomEvent('blippr:socket-state', { detail: { state: 'connected' } }));
  });
  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
    window.dispatchEvent(new CustomEvent('blippr:socket-state', { detail: { state: 'error', error } }));
  });
  socket.io.on('reconnect_attempt', (attempt) => {
    console.log('[Socket] Attempting to reconnect (attempt ' + attempt + ')...');
    window.dispatchEvent(new CustomEvent('blippr:socket-state', { detail: { state: 'connecting' } }));
  });
  socket.io.on('reconnect', (attempt) => {
    console.log('[Socket] Reconnected successfully after ' + attempt + ' attempts');
    window.dispatchEvent(new CustomEvent('blippr:socket-state', { detail: { state: 'reconnected' } }));
  });
  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected. Reason:', reason);
    window.dispatchEvent(new CustomEvent('blippr:socket-state', { detail: { state: 'connecting' } }));
  });

  return socket;
}
