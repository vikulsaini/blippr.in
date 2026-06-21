export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(error, req, res, _next) {
  let status = error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  let code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : error.code;
  let message = error.message || 'Internal server error';

  // Map PostgreSQL / Supabase constraint error codes
  if (error.code === '23505') {
    status = 409;
    code = 'DUPLICATE_KEY';
    if (error.message?.includes('profiles_username_key') || error.details?.includes('username')) {
      message = 'Username is already taken';
    } else if (error.message?.includes('profiles_email_key') || error.details?.includes('email')) {
      message = 'Email is already registered';
    } else {
      message = 'Resource already exists';
    }
  } else if (error.code === '23503') {
    status = 400;
    code = 'FOREIGN_KEY_VIOLATION';
    message = 'The referenced resource does not exist';
  } else if (error.code === '23514') {
    status = 400;
    code = 'CHECK_VIOLATION';
    message = 'Invalid data provided';
  }

  // Log error with full server-side context
  const timestamp = new Date().toISOString();
  const userId = req.user?._id || req.user?.id || 'anonymous';
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.socket?.remoteAddress;
  console.error(`[${timestamp}] RequestID=${req.id || 'N/A'} UserID=${userId} Method=${method} URL=${url} IP=${ip} - Status=${status} Code=${code || 'N/A'} Error:`, error.stack || error.message || error);

  res.status(status).json({
    ok: false,
    message,
    code,
    requestId: req.id,
    details: error.details,
    // Hide stack trace in production to prevent security leakage
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
  });
}
