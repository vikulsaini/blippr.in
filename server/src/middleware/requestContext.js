import { randomUUID } from 'node:crypto';

export function requestContext(req, res, next) {
  const requestId = req.get('x-request-id') || randomUUID();
  const startedAt = Date.now();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);

  const originalJson = res.json.bind(res);
  res.json = (body = {}) => {
    if (body && typeof body === 'object' && !Array.isArray(body) && Object.hasOwn(body, 'ok')) {
      return originalJson(body);
    }
    const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : { value: body };
    return originalJson({
      ok: true,
      data: payload,
      message: payload.message || '',
      requestId,
      ...payload
    });
  };

  res.on('finish', () => {
    const log = {
      ts: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?._id?.toString()
    };
    console.log(JSON.stringify(log));
  });

  next();
}
