import { Router } from 'express';

const router = Router();

router.get('/rtc', (_req, res) => {
  const urls = String(process.env.TURN_URLS || process.env.TURN_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  res.json({
    turn: urls.length
      ? {
          urls,
          username: process.env.TURN_USERNAME || '',
          credential: process.env.TURN_PASSWORD || process.env.TURN_CREDENTIAL || ''
        }
      : null
  });
});

export default router;
