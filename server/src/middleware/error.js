export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(error, req, res, _next) {
  const status = error.status || 500;
  res.status(status).json({
    ok: false,
    message: status === 500 ? 'Internal server error' : error.message,
    code: error.code,
    requestId: req.id,
    details: process.env.NODE_ENV === 'production' ? undefined : error.details
  });
}
