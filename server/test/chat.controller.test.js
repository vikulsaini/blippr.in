import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const Chat = (await import('../src/models/Chat.js')).default;
const Message = (await import('../src/models/Message.js')).default;
const { hideChatFromFeed, markChatRead, setChatMuted, setChatPinned } = await import('../src/controllers/chat.controller.js');
const { callHandler, chatId, chainable, makeIo, makeReq, makeRes, mongooseArray, userA, userB } = await import('./helpers.js');

beforeEach(() => {
  mock.restoreAll();
});

function makeChat(overrides = {}) {
  const chat = {
    _id: chatId,
    type: 'direct',
    members: [userA, userB],
    hiddenFor: mongooseArray(),
    pinnedFor: mongooseArray(),
    mutedFor: mongooseArray(),
    archivedFor: mongooseArray(),
    starredFor: mongooseArray(),
    unreadCounts: new Map([[userA, 4]]),
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
    },
    ...overrides
  };
  return chat;
}

test('hide chat adds only current user to hiddenFor and clears their unread count', async () => {
  const io = makeIo();
  const chat = makeChat();
  mock.method(Chat, 'findOne', () => Promise.resolve(chat));

  const res = makeRes();
  const { error } = await callHandler(
    hideChatFromFeed,
    makeReq({ params: { chatId }, app: { io } }),
    res
  );

  assert.equal(error, null);
  assert.deepEqual([...chat.hiddenFor], [userA]);
  assert.equal(chat.unreadCounts.get(userA), 0);
  assert.equal(chat.saveCalls, 1);
  assert.deepEqual(res.body, { ok: true });
  assert.deepEqual(io.emissions, [
    { room: `user:${userA}`, event: 'chat:removed', payload: { chatId, hidden: true } }
  ]);
});

test('pin preference toggles current user and emits decorated chat update', async () => {
  const io = makeIo();
  const chat = makeChat();
  const populatedChat = {
    ...chat,
    toObject: () => ({
      _id: chatId,
      members: [userA, userB],
      pinnedFor: [userA],
      mutedFor: [],
      archivedFor: [],
      starredFor: [],
      unreadCounts: {}
    })
  };
  mock.method(Chat, 'findOne', () => Promise.resolve(chat));
  mock.method(Chat, 'findById', () => chainable(populatedChat, ['populate']));

  const res = makeRes();
  const { error } = await callHandler(
    setChatPinned,
    makeReq({ params: { chatId }, body: { enabled: true }, app: { io } }),
    res
  );

  assert.equal(error, null);
  assert.deepEqual([...chat.pinnedFor], [userA]);
  assert.equal(chat.saveCalls, 1);
  assert.equal(res.body.chat.pinned, true);
  assert.equal(io.emissions[0].room, `user:${userA}`);
  assert.equal(io.emissions[0].event, 'chat:updated');
});

test('mute preference removes current user when disabled', async () => {
  const chat = makeChat({ mutedFor: mongooseArray([userA]) });
  const populatedChat = {
    ...chat,
    toObject: () => ({
      _id: chatId,
      members: [userA, userB],
      pinnedFor: [],
      mutedFor: [],
      archivedFor: [],
      starredFor: [],
      unreadCounts: {}
    })
  };
  mock.method(Chat, 'findOne', () => Promise.resolve(chat));
  mock.method(Chat, 'findById', () => chainable(populatedChat, ['populate']));

  const res = makeRes();
  const { error } = await callHandler(
    setChatMuted,
    makeReq({ params: { chatId }, body: { enabled: false } }),
    res
  );

  assert.equal(error, null);
  assert.deepEqual([...chat.mutedFor], []);
  assert.equal(res.body.chat.muted, false);
});

test('mark chat read clears unread count and safely handles messages without receipt rows', async () => {
  const io = makeIo();
  const chat = makeChat();
  const updateCalls = [];
  mock.method(Chat, 'findOne', () => Promise.resolve(chat));
  mock.method(Message, 'updateMany', (filter, update, options) => {
    updateCalls.push({ filter, update, options });
    return Promise.resolve({ modifiedCount: 1 });
  });

  const res = makeRes();
  const { error } = await callHandler(
    markChatRead,
    makeReq({ params: { chatId }, app: { io } }),
    res
  );

  assert.equal(error, null);
  assert.equal(chat.unreadCounts.get(userA), 0);
  assert.equal(chat.saveCalls, 1);
  assert.equal(updateCalls.length, 1);
  assert.deepEqual(updateCalls[0].update, {
    $set: { status: 'seen' },
    $addToSet: { seenBy: userA }
  });
  assert.deepEqual(res.body, { ok: true });
  assert.deepEqual(io.emissions, [
    { room: `chat:${chatId}`, event: 'message:seen', payload: { chatId, userId: userA } }
  ]);
});
