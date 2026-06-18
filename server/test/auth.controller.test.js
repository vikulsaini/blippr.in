import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.GUEST_LIMIT_MINUTES = '10';
process.env.GUEST_REUSE_HOURS = '24';
process.env.DISABLE_EMAIL_VERIFICATION = 'true';

const User = (await import('../src/models/User.js')).default;
const { signupWithEmail, loginWithEmail, continueAsGuest } = await import('../src/controllers/auth.controller.js');
const { requireAuth } = await import('../src/middleware/auth.js');
const { callHandler, chainable, expectError, makeReq, makeRes, userA } = await import('./helpers.js');

beforeEach(() => {
  mock.restoreAll();
  process.env.NODE_ENV = 'test';
  process.env.DISABLE_EMAIL_VERIFICATION = 'true';
  process.env.EXPOSE_EMAIL_CODE_IN_RESPONSE = 'false';
});

test('email signup rejects duplicate usernames', async () => {
  mock.method(User, 'findOne', () => Promise.resolve(null));
  mock.method(User, 'exists', () => Promise.resolve({ _id: userA }));

  const { error } = await callHandler(
    signupWithEmail,
    makeReq({
      body: {
        name: 'Asha',
        username: 'taken_name',
        email: 'asha@example.com',
        password: 'password123',
        age: 22,
        gender: 'female'
      }
    })
  );

  expectError(error, 409, 'Username is already taken');
});

test('email signup creates a user, token, and httpOnly auth cookie', async () => {
  mock.method(User, 'findOne', () => Promise.resolve(null));
  mock.method(User, 'exists', () => Promise.resolve(null));
  mock.method(User, 'create', async (payload) => ({
    _id: userA,
    phone: undefined,
    toString: () => userA,
    ...payload
  }));

  const res = makeRes();
  const { error } = await callHandler(
    signupWithEmail,
    makeReq({
      body: {
        name: 'Asha',
        username: 'asha_22',
        email: 'asha@example.com',
        password: 'password123',
        age: 22,
        gender: 'female',
        bio: 'hello'
      }
    }),
    res
  );

  assert.equal(error, null);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.user.username, 'asha_22');
  assert.ok(res.body.token);
  assert.equal(res.cookies[0].name, 'blippr_token');
  assert.equal(res.cookies[0].options.httpOnly, true);
});

test('email login returns 403 when provider is missing and does not leak verification code', async () => {
  process.env.NODE_ENV = 'production';
  process.env.DISABLE_EMAIL_VERIFICATION = 'false';
  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash('password123', 4);
  const unverifiedUser = {
    _id: userA,
    email: 'asha@example.com',
    passwordHash,
    emailVerifiedAt: undefined
  };
  mock.method(User, 'findOne', () => chainable(unverifiedUser, ['select']));

  const res = makeRes();
  const { error } = await callHandler(
    loginWithEmail,
    makeReq({
      body: {
        email: 'asha@example.com',
        password: 'password123'
      }
    }),
    res
  );

  assert.equal(error, null);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(res.body.emailSent, false);
  assert.equal(res.body.verificationCode, undefined);
});

test('guest login reuses recent guest from the same IP', async () => {
  const saveCalls = [];
  const existingGuest = {
    _id: userA,
    isGuest: true,
    gender: 'male',
    lastIp: '10.0.0.8',
    ipHistory: [],
    save: async function save() {
      saveCalls.push(this);
    }
  };
  mock.method(User, 'findOne', () => chainable(existingGuest, ['select']));
  mock.method(User, 'create', () => {
    throw new Error('Should not create a new guest when reusable guest exists');
  });

  const res = makeRes();
  const { error } = await callHandler(continueAsGuest, makeReq({ body: { age: 21, gender: 'male' } }), res);

  assert.equal(error, null);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reused, true);
  assert.equal(res.body.user._id, userA);
  assert.equal(saveCalls.length, 1);
});

test('guest expiry blocks protected routes but allows upgrade route', async () => {
  const expiredGuest = {
    _id: userA,
    isGuest: true,
    guestExpiresAt: new Date(Date.now() - 1000)
  };
  mock.method(User, 'findById', () => Promise.resolve(expiredGuest));

  const jwt = (await import('jsonwebtoken')).default;
  const token = jwt.sign({ sub: userA }, process.env.JWT_SECRET);

  const blockedReq = makeReq({
    headers: { authorization: `Bearer ${token}` },
    originalUrl: '/api/chats'
  });
  let blockedError = null;
  await requireAuth(blockedReq, makeRes(), (error) => {
    blockedError = error;
  });
  expectError(blockedError, 403, 'Guest session expired. Create an account to continue.');
  assert.equal(blockedError.code, 'GUEST_EXPIRED');

  const upgradeReq = makeReq({
    headers: { authorization: `Bearer ${token}` },
    originalUrl: '/api/auth/guest/upgrade'
  });
  let upgradeError = null;
  await requireAuth(upgradeReq, makeRes(), (error) => {
    upgradeError = error;
  });
  assert.equal(upgradeError, undefined);
  assert.equal(upgradeReq.user, expiredGuest);
});
