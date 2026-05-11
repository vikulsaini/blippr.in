# Varta

Varta is a mobile-first real-time chat PWA with friends, nearby/random matching, profile safety tools, push notifications, and WebRTC audio/video calling.

## Features

- Email/password signup and login with user-created unique usernames and email verification codes.
- Guest login with same-IP reuse, limited guest access, throttled phone OTP flow, and Google login hook.
- Editable profile with avatar URL, bio, gender, age, username, privacy toggles, and safety words.
- Friends chat list with unread counts, active status, last seen, nicknames, reactions, replies, typing animation, archived chats, favorites, pin, mute, and multi-select delete.
- Real-time one-to-one messaging with Socket.IO and MongoDB persistence.
- Offline message retry queue and local chat cache so old chats show quickly on app open.
- Friend requests and system notifications in the notification bell with accept/reject/cancel flows.
- Match page with active nearby users and random-anywhere matching.
- Block, unblock, report, unfriend, blocked-user list, account export, and account delete.
- WebRTC voice/video calls with TURN support, synced remote video/audio playback, incoming call UI, mute, speaker/receiver route, camera toggle, switch camera, low-data mode, reconnect timeout, quality label, and call history with duration in chat.
- Push notification subscription support plus message/call sound preferences.
- Installable PWA from the browser, including Android "Install app / Add to home screen".

## Stack

- Frontend: React, Vite, Tailwind CSS, Framer Motion.
- Backend: Node.js, Express.js, Socket.IO.
- Database/cache: MongoDB, Redis.
- Auth: JWT, httpOnly auth cookie support, email/password, guest, phone OTP, Google token hook.
- Calling: WebRTC with Socket.IO signaling, STUN/TURN, and browser media device routing where supported.
- Media/storage: Cloudinary-ready backend utilities.
- Deployment targets: Vercel frontend, Render backend.

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

Run backend tests:

```bash
npm run test --workspace server
```

## Environment

Server env lives in `server/.env`.

Important values:

- `MONGO_URI`
- `REDIS_URL`
- `JWT_SECRET`
- `CLIENT_URL`
- `OTP_TTL_SECONDS`
- `OTP_COOLDOWN_SECONDS`
- `OTP_MAX_ATTEMPTS`
- `GUEST_REUSE_HOURS` - same-IP guest sessions reuse a recent guest account within this window.
- `EXPOSE_OTP_IN_RESPONSE` - set to `true` only while testing if SMS is not configured.
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `EMAIL_CODE_TTL_SECONDS`
- `EMAIL_CODE_COOLDOWN_SECONDS`
- `EMAIL_CODE_MAX_ATTEMPTS`
- `EXPOSE_EMAIL_CODE_IN_RESPONSE` - set to `true` only while testing if email delivery is not configured.
- `DISABLE_EMAIL_VERIFICATION` - local escape hatch only; keep `false` in production.
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `GOOGLE_CLIENT_ID`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `TURN_URL` or `TURN_URLS` - comma-separated TURN URLs for production WebRTC.
- `TURN_USERNAME`
- `TURN_PASSWORD`
- `JWT_COOKIE_MAX_AGE_MS` - optional httpOnly auth cookie lifetime.
- `GUEST_LOGIN_LIMIT_PER_WINDOW` - optional guest-login throttle per 10 minutes, defaults to `12`.

Client env lives in `client/.env`.

Important values:

- `VITE_API_URL`
- `VITE_SOCKET_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_TURN_URLS` - comma-separated TURN URLs for reliable calls across mobile networks.
- `VITE_TURN_USERNAME`
- `VITE_TURN_PASSWORD`

For WebRTC calls, STUN is enough only on some networks. Use a TURN provider for production so audio/video can connect through strict NATs, carrier networks, and office Wi-Fi.

The API also sets an httpOnly `varta_token` cookie on login/signup/guest auth. The frontend still keeps the JWT for compatibility with Socket.IO auth, but REST requests include credentials and the backend can authenticate from the cookie when no bearer token is sent.

OTP and email verification require real providers in production. Configure Twilio for phone OTP and Resend for email verification, or temporarily set `EXPOSE_OTP_IN_RESPONSE=true` / `EXPOSE_EMAIL_CODE_IN_RESPONSE=true` only for private testing.

## Quality Checks

Current backend test coverage includes:

- Auth controller: email signup, duplicate username handling, guest reuse.
- Guest expiry middleware behavior.
- Chat hide, pin, and mute preferences.
- Friend request send/accept flow with notification/socket side effects.

Useful commands:

```bash
npm run lint --workspace server
npm run test --workspace server
npm run lint --workspace client
npm run build --workspace client
```

## Browser Install

Varta is configured as an installable PWA. Open the app in a supported browser, then go to:

`Profile > App > Install Varta`

On Android Chrome/Edge this opens the native browser install prompt. If the prompt is not available, use the browser menu and choose `Install app` or `Add to home screen`.

This is browser-based installation, not a generated APK file. For a store/APK build later, wrap the deployed PWA with TWA or Capacitor.

## Android With Capacitor

Varta can also run as an independent Android app while keeping the same web app live.

One-time setup after installing dependencies:

```bash
npm run android:add --workspace client
```

After frontend changes:

```bash
npm run cap:sync --workspace client
```

Open the Android project:

```bash
npm run android:open --workspace client
```

Then build an APK/AAB from Android Studio. The Android app uses the same backend API and Socket.IO server as the web app.

Local APK builds require Android Studio plus a JDK with `JAVA_HOME` set. If `gradlew assembleDebug` says Java is missing, install Android Studio/JDK first, then reopen the terminal.

For best Android calling and push behavior later, add native Capacitor plugins for push notifications, local notifications, media permissions, and audio routing.

## Main App Areas

- `Chats`: friends list, search, unread counts, conversations, call history.
- `Match`: active nearby matches and random-anywhere matches.
- `Find`: username/name search only.
- `Profile`: account edits, privacy, safety, blocked users, push notifications, sounds, install app.
- `Privacy` and `Terms`: public pages linked from the landing page and profile settings.

## Tester Checklist

Share the live app link with testers and ask them to verify:

- Signup/login, guest upgrade, and logout.
- Sending friend requests, accepting requests, and opening the created chat.
- Messaging, image upload, voice notes, reactions, edit/delete, and unread counts.
- Matching on nearby mode and random mode.
- Audio/video calls on two different mobile networks after TURN credentials are configured.
- Push notifications after installing the PWA and allowing notifications.

Live app:

`https://client-bice-one-x6xfheue7f.vercel.app`

## Documentation

- [Folder structure](docs/FOLDER_STRUCTURE.md)
- [API routes](docs/API_ROUTES.md)
- [Socket events](docs/SOCKET_EVENTS.md)
- [Deployment](docs/DEPLOYMENT.md)
