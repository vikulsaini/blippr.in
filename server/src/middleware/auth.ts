import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  
  // Also check for token in cookies as a fallback
  const cookieToken = req.headers.cookie
    ?.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('blippr_token='))
    ?.split('=')[1];

  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (cookieToken) {
    token = cookieToken;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET) as {
      sub?: string;
      email?: string;
      role?: string;
    };
    
    if (!payload.sub) {
      res.status(401).json({ error: 'Invalid token: missing user identifier' });
      return;
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
};
