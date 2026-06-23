import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    email?: string;
  };
}

export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.['authorization'];

  if (!token) {
    next(new Error('Authentication error: Token not provided'));
    return;
  }

  // Remove Bearer prefix if present
  const cleanedToken = token.startsWith('Bearer ') ? token.slice(7) : token;

  // 1. Try local verify (works for guests and legacy HS256 tokens)
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
  } catch (localErr) {
    // 2. Fallback to Supabase remote/asymmetric verification (for RS256 signing keys)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser(cleanedToken);
      if (authError || !user) {
        next(new Error('Authentication error: Invalid or expired token'));
        return;
      }

      socket.data = {
        ...socket.data,
        userId: user.id,
        email: user.email,
      };

      next();
    } catch (err: any) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  }
};
