export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  res.status(status).json({
    message: status === 500 ? 'Internal server error' : error.message,
    code: error.code,
    details: process.env.NODE_ENV === 'production' ? undefined : error.details
  });
}
