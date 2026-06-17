export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(error, req, res, _next) {
  const status = error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : error.code;

  // Log error with full server-side context
  const timestamp = new Date().toISOString();
  const userId = req.user?._id?.toString() || 'anonymous';
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.socket?.remoteAddress;
  console.error(`[${timestamp}] RequestID=${req.id || 'N/A'} UserID=${userId} Method=${method} URL=${url} IP=${ip} - Status=${status} Code=${code || 'N/A'} Error:`, error.stack || error.message || error);

  res.status(status).json({
    ok: false,
    message: status === 500 ? 'Internal server error' : error.code === 'LIMIT_FILE_SIZE' ? 'File is too large. Please choose a file under 25 MB.' : error.message,
    code,
    requestId: req.id,
    details: process.env.NODE_ENV === 'production' ? undefined : error.details
  });
}
