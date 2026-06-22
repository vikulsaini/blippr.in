import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export interface CustomError extends Error {
  status?: number;
  statusCode?: number;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.status || err.statusCode || 500;
  const isDevelopment = env.NODE_ENV === 'development';

  console.error(`[Error Handler] ${req.method} ${req.url} - Status ${statusCode}:`, err);

  res.status(statusCode).json({
    error: {
      message: statusCode === 500 && !isDevelopment
        ? 'Internal Server Error'
        : err.message,
      ...(isDevelopment && { stack: err.stack }),
    },
  });
};
