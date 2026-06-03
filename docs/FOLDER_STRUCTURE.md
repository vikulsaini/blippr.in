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

## Mobile Install

The current repo is web/PWA focused. Users can install Varta from supported browsers with `Install app` / `Add to home screen`.

For a store APK/AAB later, add a fresh native wrapper around the deployed Vercel URL.
