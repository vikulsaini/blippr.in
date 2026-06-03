export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(error, req, res, _next) {
  const status = error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : error.code;
  res.status(status).json({
    ok: false,
    message: status === 500 ? 'Internal server error' : error.code === 'LIMIT_FILE_SIZE' ? 'File is too large. Please choose a file under 20 MB.' : error.message,
    code,
    requestId: req.id,
    details: process.env.NODE_ENV === 'production' ? undefined : error.details
  });
}
