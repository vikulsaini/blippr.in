# Varta

Varta is a mobile-first real-time chat PWA with friends, nearby/random matching, profile safety tools, push notifications, and WebRTC audio/video calling.

## Features

- Email/password signup and login with user-created unique usernames
- Guest login, phone OTP flow, and Google login hook
- Editable profile with avatar URL, bio, gender, age, and username
- Friends chat list with unread counts, active status, last seen, nicknames, reactions, replies, and typing animation
- Real-time one-to-one messaging with Socket.IO and MongoDB persistence
- Friend requests in the notification bell with accept/reject/cancel flows
- Match page with nearby users and random-anywhere matching
- Block, unblock, report, unfriend, and blocked-user list
- WebRTC voice/video calls with incoming call UI, mute, camera toggle, switch camera, and call history with duration in chat
- Push notification subscription support
- Installable PWA from the browser, including Android “Install app / Add to home screen”

## Stack

- Frontend: React, Vite, Tailwind CSS, Framer Motion
- Backend: Node.js, Express.js, Socket.IO
- Database/cache: MongoDB, Redis
- Auth: JWT, email/password, guest, phone OTP, Google token hook
- Calling: WebRTC with Socket.IO signaling
- Media/storage: Cloudinary-ready backend utilities
- Deployment targets: Vercel frontend, Render backend

## Quick Start

```bash
corepack enable
pnpm install
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
docker compose up -d
pnpm --filter @varta/server dev
pnpm --filter @varta/client dev
```

Backend defaults to `http://localhost:8080`.
Frontend defaults to `http://localhost:5173`.

For production frontend build:

```bash
pnpm --filter @varta/client build
```

## Environment

Server env lives in `server/.env`.

Important values:

- `MONGO_URI`
- `REDIS_URL`
- `JWT_SECRET`
- `CLIENT_URL`
- `OTP_TTL_SECONDS`
- `GUEST_REUSE_HOURS` - same-IP guest sessions reuse a recent guest account within this window
- `EXPOSE_OTP_IN_RESPONSE` - set to `true` only while testing if SMS is not configured
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `GOOGLE_CLIENT_ID`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Client env lives in `client/.env`.

Important values:

- `VITE_API_URL`
- `VITE_SOCKET_URL`
- `VITE_GOOGLE_CLIENT_ID`

## Browser Install

Varta is configured as an installable PWA. Open the app in a supported browser, then go to:

`Profile > App > Install Varta`

On Android Chrome/Edge this opens the native browser install prompt. If the prompt is not available, use the browser menu and choose `Install app` or `Add to home screen`.

This is browser-based installation, not a generated APK file. For a store/APK build later, wrap the deployed PWA with TWA or Capacitor.

## Main App Areas

- `Chats`: friends list, search, unread counts, conversations, call history
- `Match`: nearby matches and random-anywhere matches
- `Find`: username/name search only
- `Profile`: account edits, avatar URL, blocked users, push notifications, install app

## Documentation

- [Folder structure](docs/FOLDER_STRUCTURE.md)
- [API routes](docs/API_ROUTES.md)
- [Socket events](docs/SOCKET_EVENTS.md)
- [Deployment](docs/DEPLOYMENT.md)
