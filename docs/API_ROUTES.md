# API Routes

Base URL: `/api`

## Auth

- `POST /auth/otp/request` `{ phone }`
- `POST /auth/otp/verify` `{ phone, otp, name, age, gender, bio }` returns `{ token, user }`
- `POST /auth/email/signup` `{ name, email, password, age, gender, bio }` returns `{ token, user }`
- `POST /auth/email/login` `{ email, password }` returns `{ token, user }`
- `POST /auth/guest` `{ age, gender, bio }` returns a random guest id, generated avatar, `{ token, user }`
- `POST /auth/guest/upgrade` `{ name, email, password, age, gender, bio }` upgrades a guest account
- `POST /auth/google` `{ idToken, name, avatar }` returns `{ token, user }`

## Users and Discover

- `GET /users/me`
- `PATCH /users/me` `{ name, username, age, gender, bio, avatar, interests }`
- `PATCH /users/me/location` `{ latitude, longitude }`
- `GET /users/search?q=username`
- `GET /users/suggested`
- `GET /users/nearby?maxDistance=25000`
- `GET /users/available?maxDistance=25000`

## Chats and Messages

- `GET /chats`
- `POST /chats` `{ userId }`
- `GET /chats/:chatId/messages`
- `POST /chats/:chatId/messages` `{ text, media }`
- `DELETE /chats/:chatId/messages/:messageId`

## Friends

- `GET /friends/requests`
- `GET /friends/requests/sent`
- `POST /friends/requests` `{ userId }`
- `PATCH /friends/requests/:id` `{ status: "accepted" | "rejected" }`

## Notifications

- `GET /notifications/public-key`
- `POST /notifications/subscriptions` browser push subscription JSON
- `DELETE /notifications/subscriptions` `{ endpoint }`

Push notifications are sent for friend requests, new messages, and incoming calls when `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are configured.

## Calls

- `GET /calls`
- WebRTC signaling uses Socket.IO events from `docs/SOCKET_EVENTS.md`; calls are persisted with status history.

## Safety

- `POST /safety/block` `{ userId }`
- `POST /safety/unblock` `{ userId }`
- `POST /safety/report` `{ userId, reason, notes }`

## Media

- `POST /media/upload` multipart field `file`; returns Cloudinary URL metadata.

All protected routes require `Authorization: Bearer <jwt>`.
