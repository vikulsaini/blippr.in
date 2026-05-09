import assert from 'node:assert/strict';

export const userA = '507f1f77bcf86cd799439011';
export const userB = '507f1f77bcf86cd799439012';
export const chatId = '507f1f77bcf86cd799439013';
export const requestId = '507f1f77bcf86cd799439014';

export function makeReq({ user = {}, body = {}, params = {}, query = {}, headers = {}, app = {}, originalUrl = '/api/test' } = {}) {
  const io = app.io || makeIo();
  return {
    user: {
      _id: userA,
      name: 'Asha',
      username: 'asha',
      blockedUsers: [],
      ...user
    },
    body,
    params,
    query,
    headers,
    originalUrl,
    ip: '10.0.0.8',
    socket: { remoteAddress: '10.0.0.8' },
    app: {
      get(key) {
        if (key === 'io') return io;
        return app[key];
      }
    }
  };
}

export function makeRes() {
  return {
    statusCode: 200,
    body: null,
    cookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.cookies.push({ name, value: '', options, cleared: true });
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

export function makeIo() {
  const emissions = [];
  return {
    emissions,
    to(room) {
      return {
        emit(event, payload) {
          emissions.push({ room, event, payload });
        }
      };
    }
  };
}

export async function callHandler(handler, req = makeReq(), res = makeRes()) {
  let capturedError = null;
  await handler(req, res, (error) => {
    capturedError = error;
  });
  return { req, res, error: capturedError };
}

export function expectError(error, status, message) {
  assert.ok(error, 'Expected handler to pass an error to next()');
  assert.equal(error.status, status);
  if (message) assert.equal(error.message, message);
}

export function chainable(value, methods = ['select', 'populate', 'sort', 'limit']) {
  const query = Promise.resolve(value);
  for (const method of methods) {
    query[method] = () => query;
  }
  return query;
}

export function mongooseArray(initial = []) {
  const value = [...initial];
  value.addToSet = (item) => {
    if (!value.some((entry) => entry.toString() === item.toString())) value.push(item);
  };
  value.pull = (item) => {
    const index = value.findIndex((entry) => entry.toString() === item.toString());
    if (index !== -1) value.splice(index, 1);
  };
  return value;
}
