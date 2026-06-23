import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
    user_metadata?: {
      name?: string;
      age?: number;
      gender?: string;
      bio?: string;
    };
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
    // 1. Try local verify (works for guests and legacy HS256 tokens)
    const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET) as {
      sub?: string;
      email?: string;
      role?: string;
      user_metadata?: {
        name?: string;
        age?: number;
        gender?: string;
        bio?: string;
      };
    };
    
    if (!payload.sub) {
      res.status(401).json({ error: 'Invalid token: missing user identifier' });
      return;
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      user_metadata: payload.user_metadata,
    };
    next();
  } catch (error) {
    // 2. Fallback to Supabase remote/asymmetric verification (for RS256 signing keys)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        res.status(401).json({ error: 'Invalid or expired authentication token', details: authError?.message });
        return;
      }
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        user_metadata: user.user_metadata as any,
      };
      next();
    } catch (err: any) {
      res.status(401).json({ error: 'Invalid or expired authentication token', details: err?.message });
    }
  }
};
