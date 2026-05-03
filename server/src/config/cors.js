const defaultOrigins = [
  'http://localhost:5173',
  'https://client-bice-one-x6xfheue7f.vercel.app'
];

const configuredOrigins = [...defaultOrigins, ...(process.env.CLIENT_URL || '').split(',')]
  .map((origin) => origin.trim())
  .filter(Boolean);

function isLocalDevOrigin(origin) {
  if (process.env.NODE_ENV === 'production') return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  return configuredOrigins.includes(origin) || isLocalDevOrigin(origin);
}

export const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
};

export const socketCorsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
};
