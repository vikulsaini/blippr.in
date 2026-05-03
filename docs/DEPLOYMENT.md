# Deployment

## Frontend on Vercel

1. Set project root to `client`.
2. Add environment variables:
   - `VITE_API_URL=https://your-render-api.onrender.com`
   - `VITE_SOCKET_URL=https://your-render-api.onrender.com`
   - `VITE_GOOGLE_CLIENT_ID=...`
3. Build command: `npm run build`
4. Output directory: `dist`

## Backend on Render

Use `render.yaml` or create a Web Service with root `server`.

Required variables:

- `NODE_ENV=production`
- `CLIENT_URL=https://your-varta.vercel.app`
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
- Generate VAPID keys with `npx web-push generate-vapid-keys` and set them in Render/Vercel environments.
- Add TURN credentials for reliable WebRTC calls on restrictive networks.
- Store secrets only in deployment provider environment settings.

## Local Services

MongoDB and Redis can be started with:

```bash
docker compose up -d
```
