# Deployment

## Frontend on Vercel

1. Set project root to `client`.
2. Add environment variables:
   - `VITE_API_URL=https://api.blippr.in`
   - `VITE_SOCKET_URL=https://api.blippr.in`
   - `VITE_GOOGLE_CLIENT_ID=...`
3. Build command: `npm run build`
4. Output directory: `dist`

## Backend on Railway

Create a Web Service on Railway with the root directory set to `server`. Enable automatic deployments.

Required variables:

- `NODE_ENV=production`
- `CLIENT_URL=https://your-blippr.vercel.app`
- `MONGO_URI`
- `REDIS_URL`
- `JWT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `GOOGLE_CLIENT_ID`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

## Production Notes

- Replace the development OTP logger with SMS delivery such as Twilio, MSG91, or Firebase Auth.
- Google ID tokens are verified server-side with `google-auth-library`; keep `GOOGLE_CLIENT_ID` exact.
- Add APNs/FCM web push keys for real push notifications.
- Generate VAPID keys with `npx web-push generate-vapid-keys` and set them in Railway/Vercel environments.
- Add TURN credentials for reliable WebRTC calls on restrictive networks.
- Store secrets only in deployment provider environment settings.

## Local Services

Use hosted MongoDB Atlas and Upstash/Redis URLs in `server/.env`, or run your own MongoDB/Redis services outside this repo and point `MONGO_URI` / `REDIS_URL` at them.
