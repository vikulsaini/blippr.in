# Socket Events

Socket auth uses:

```js
io(SOCKET_URL, { auth: { token } })
```

## Chat

- Client emits `chat:join` `{ chatId }`
- Client emits `message:send` `{ chatId, text, media }`
- Server emits `message:new` `{ message }`
- Client emits `message:delivered` `{ messageId }`
- Client emits `message:seen` `{ messageId }`
- Server emits `message:status` `{ messageId, status }`
- Client emits `typing:start` / `typing:stop` `{ chatId }`
- Server emits `typing:start` / `typing:stop` `{ chatId, userId }`

## Stranger Chat

- Client emits `stranger:find` `{ interests }`
- Server ack returns `{ matched, chat?, roomId?, ticket? }`
- Server emits `stranger:matched` `{ chat }`
- Client emits `stranger:next` `{ interests }`

Redis queues are stored as `matchmaking:<interest>`.

## Presence

- Server emits `presence:update` `{ userId, isOnline }`

## WebRTC Calling

- Client emits `call:offer` `{ to, offer, callType }`
- Server emits `call:incoming` `{ callId, from, offer, callType }`
- Client ack receives `{ ok, callId }`
- Client emits `call:answer` `{ to, answer, callId }`
- Server emits `call:answer` `{ from, answer, callId }`
- Client emits `call:ice-candidate` `{ to, candidate }`
- Server emits `call:ice-candidate` `{ from, candidate }`
- Client emits `call:reject` / `call:end` `{ to, callId }`

Incoming calls trigger push notifications when the receiver has registered a browser push subscription.
