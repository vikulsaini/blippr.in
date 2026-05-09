import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const Chat = (await import('../src/models/Chat.js')).default;
const FriendRequest = (await import('../src/models/FriendRequest.js')).default;
const Notification = (await import('../src/models/Notification.js')).default;
const User = (await import('../src/models/User.js')).default;
const { respondFriendRequest, sendFriendRequest } = await import('../src/controllers/friend.controller.js');
const { callHandler, chainable, chatId, makeIo, makeReq, makeRes, requestId, userA, userB } = await import('./helpers.js');

beforeEach(() => {
  mock.restoreAll();
});

test('sending a friend request validates blocking, upserts request, emits socket, and creates notification', async () => {
  const io = makeIo();
  const request = {
    _id: requestId,
    from: userA,
    to: userB,
    status: 'pending',
    async populate() {
      this.from = { _id: userA, name: 'Asha', username: 'asha' };
      return this;
    }
  };
  mock.method(User, 'findById', () => chainable({ _id: userB, blockedUsers: [] }, ['select']));
  mock.method(FriendRequest, 'findOneAndUpdate', (_filter, update, options) => {
    assert.equal(update.status, 'pending');
    assert.equal(options.upsert, true);
    return Promise.resolve(request);
  });
  mock.method(Notification, 'create', (payload) =>
    Promise.resolve({
      _id: 'notification-1',
      ...payload
    })
  );

  const res = makeRes();
  const { error } = await callHandler(
    sendFriendRequest,
    makeReq({ body: { userId: userB }, app: { io } }),
    res
  );

  assert.equal(error, null);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.request._id, requestId);
  assert.equal(io.emissions[0].room, `user:${userB}`);
  assert.equal(io.emissions[0].event, 'friend:request:new');
  assert.equal(io.emissions[1].event, 'notification:new');
});

test('accepting a friend request creates a direct chat and notifies sender', async () => {
  const io = makeIo();
  const request = {
    _id: requestId,
    from: userB,
    to: userA,
    status: 'pending',
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
    }
  };
  const chat = { _id: chatId, type: 'direct', members: [userA, userB], temporary: false };
  mock.method(FriendRequest, 'findOne', () => Promise.resolve(request));
  mock.method(Chat, 'findOne', () => Promise.resolve(null));
  mock.method(Chat, 'create', (payload) => {
    assert.deepEqual(payload.members, [userA, userB].sort());
    assert.equal(payload.temporary, false);
    return Promise.resolve(chat);
  });
  mock.method(Chat, 'findById', () => chainable(chat, ['populate']));
  mock.method(Notification, 'create', (payload) =>
    Promise.resolve({
      _id: 'notification-accepted',
      ...payload
    })
  );

  const res = makeRes();
  const { error } = await callHandler(
    respondFriendRequest,
    makeReq({ params: { id: requestId }, body: { status: 'accepted' }, app: { io } }),
    res
  );

  assert.equal(error, null);
  assert.equal(request.status, 'accepted');
  assert.equal(request.saveCalls, 1);
  assert.equal(res.body.chat._id, chatId);
  assert.ok(io.emissions.some((item) => item.room === `user:${userB}` && item.event === 'friend:request:accepted'));
  assert.ok(io.emissions.some((item) => item.room === `user:${userA}` && item.event === 'chat:updated'));
  assert.ok(io.emissions.some((item) => item.room === `user:${userB}` && item.event === 'notification:new'));
});
