# Folder Structure

```text
varta/
  client/
    src/
      components/       Reusable UI, chat and call surfaces
      pages/            Auth, chats, stranger, discover, profile
      lib/              API, Socket.IO, WebRTC helpers
    public/             PWA icon assets
    vercel.json         Vercel SPA deployment config
    capacitor.config.json
  server/
    src/
      config/           MongoDB, Redis, Cloudinary setup
      controllers/      REST feature handlers
      middleware/       Auth, validation, rate limits, errors
      models/           Mongoose schemas
      routes/           Express route modules
      services/         OTP, matchmaking, media services
      sockets/          Socket.IO auth and event handling
  docs/
  render.yaml           Render backend deployment config
```

## APK Support

For Capacitor:

```bash
cd client
npm install @capacitor/core @capacitor/cli @capacitor/android
npm run build
npx cap add android
npx cap sync android
```

For TWA, use Bubblewrap against the deployed Vercel URL after adding final production icons and asset links.
