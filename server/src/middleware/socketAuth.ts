import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    email?: string;
  };
}

export const socketAuthMiddleware = (
  socket: Socket,
  next: (err?: Error) => void
): void => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.['authorization'];

  if (!token) {
    next(new Error('Authentication error: Token not provided'));
    return;
  }

  // Remove Bearer prefix if present
  const cleanedToken = token.startsWith('Bearer ') ? token.slice(7) : token;

  try {
    const payload = jwt.verify(cleanedToken, env.SUPABASE_JWT_SECRET) as any;
    if (!payload || !payload.sub) {
      next(new Error('Authentication error: User identifier sub is missing in token'));
      return;
    }

    socket.data = {
      ...socket.data,
      userId: payload.sub,
      email: payload.email,
    };

    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid or expired token'));
  }
};
