import { io } from 'socket.io-client';
import { getToken } from './api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8080';

export function createSocket() {
  return io(SOCKET_URL, {
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
}
