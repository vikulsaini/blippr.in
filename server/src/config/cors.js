const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://blippr.in',
  'https://www.blippr.in'
];

const configuredOrigins = [...defaultOrigins, ...(process.env.CLIENT_URL || '').split(',')]
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

function isLocalDevOrigin(origin) {
  if (process.env.NODE_ENV === 'production') return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalizedOrigin = origin.trim().replace(/\/$/, '');
  
  // Allow the main domain and any subdomains of blippr.in
  if (/^https?:\/\/(.*\.)?blippr\.in$/i.test(normalizedOrigin)) {
    return true;
  }
  
  // Allow preview environments on Cloudflare Pages and Vercel
  if (normalizedOrigin.endsWith('.pages.dev') || normalizedOrigin.endsWith('.vercel.app')) {
    return true;
  }
  
  return configuredOrigins.includes(normalizedOrigin) || isLocalDevOrigin(normalizedOrigin);
}

export const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
};

export const socketCorsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
};
