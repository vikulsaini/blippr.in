import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { redisClient } from '../config/redis.js';
import { supabase } from '../config/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Determine the correct socket URL based on environment
function getSocketUrl(): string {
  // If an explicit client URL is set, use it (works for Railway and custom domains)
  if (env.CLIENT_URL) return env.CLIENT_URL;
  // Railway dynamic domain
  if (env.RAILWAY_PUBLIC_DOMAIN) return `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  // Fallback to production domain or localhost
  if (env.NODE_ENV === 'production') return 'https://api.blippr.in';
  return `http://localhost:${env.PORT}`;
}

// 1. General Application Configuration (Public)
router.get('/app', (req, res) => {
  res.status(200).json({
    appName: 'Varta',
    environment: env.NODE_ENV,
    socketUrl: getSocketUrl(),
    features: {
      matchmaking: true,
      webrtc: true,
      persistentChat: true,
    },
  });
});

// 2. WebRTC Server Settings / ICE configuration (Authenticated to prevent bandwidth/session abuse)
router.get('/rtc', authMiddleware, (req, res) => {
  const turnUrlsStr = process.env.TURN_URLS || '';
  const urls = turnUrlsStr
    ? turnUrlsStr.split(',').map((u) => u.trim()).filter(Boolean)
    : [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
      ];

  res.status(200).json({
    turn: {
      urls,
      username: process.env.TURN_USERNAME || undefined,
      credential: process.env.TURN_PASSWORD || process.env.TURN_CREDENTIAL || undefined,
    },
  });
});

// 3. Database & Cache Connectivity Status (Public Health check)
router.get('/status', async (req, res) => {
  let redisConnected = false;
  let mongodbConnected = false;
  let supabaseConnected = false;

  try {
    if (redisClient.isOpen) {
      const response = await redisClient.ping();
      if (response === 'PONG') {
        redisConnected = true;
      }
    }
  } catch (err) {
    console.error('[Status API] Redis check failed:', err);
  }

  try {
    // Ping MongoDB using readyState
    if (mongoose.connection.readyState === 1) {
      mongodbConnected = true;
    }
  } catch (err) {
    console.error('[Status API] MongoDB check failed:', err);
  }

  try {
    const { error } = await supabase.auth.getSession();
    if (!error) {
      supabaseConnected = true;
    }
  } catch (err) {
    console.error('[Status API] Supabase check failed:', err);
  }

  const overallHealthy = redisConnected && mongodbConnected && supabaseConnected;

  res.status(overallHealthy ? 200 : 503).json({
    status: overallHealthy ? 'healthy' : 'degraded',
    services: {
      redis: redisConnected ? 'connected' : 'disconnected',
      mongodb: mongodbConnected ? 'connected' : 'disconnected',
      supabase: supabaseConnected ? 'connected' : 'disconnected',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
