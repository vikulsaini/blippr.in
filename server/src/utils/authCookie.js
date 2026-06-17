const COOKIE_NAME = 'blippr_token';

export function readAuthCookie(req) {
  const raw = req.headers.cookie || '';
  return raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
}

export function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: Number(process.env.JWT_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000),
    path: '/'
  });
}

export function clearAuthCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/'
  });
}
