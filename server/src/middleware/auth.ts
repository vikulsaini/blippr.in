import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

export interface UserMetadata {
  name?: string;
  age?: number;
  gender?: string;
  bio?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
    user_metadata?: UserMetadata;
  };
  file?: Express.Multer.File;
}

interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  user_metadata?: UserMetadata;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  // Fallback: check for token in cookies
  const cookieToken = req.headers.cookie
    ?.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('blippr_token='))
    ?.split('=')[1];

  return cookieToken || null;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
    return;
  }

  try {
    // 1. Try local verify (works for guests and legacy HS256 tokens)
    const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET) as JwtPayload;

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
  } catch {
    // 2. Fallback to Supabase remote/asymmetric verification (for RS256 signing keys)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        res.status(401).json({ error: 'Invalid or expired authentication token' });
        return;
      }
      req.user = {
        id: user.id,
        email: user.email ?? undefined,
        role: user.role,
        user_metadata: user.user_metadata as UserMetadata | undefined,
      };
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired authentication token' });
    }
  }
};
