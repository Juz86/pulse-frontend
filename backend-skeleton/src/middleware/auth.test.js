import test from 'node:test';
import assert from 'node:assert/strict';
import { getDevUidFromHeaders, getDevUidFromSocketAuth, requireAuth } from './auth.js';

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('requireAuth accepts x-dev-uid when local bypass is enabled', async () => {
  const previous = process.env.ALLOW_DEV_AUTH_BYPASS;
  process.env.ALLOW_DEV_AUTH_BYPASS = 'true';

  const req = {
    headers: {
      'x-dev-uid': 'uid_child_1',
    },
  };
  const res = createResponseRecorder();
  let nextCalled = false;

  try {
    await requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.auth, {
      uid: 'uid_child_1',
      devBypass: true,
    });
    assert.equal(res.body, null);
  } finally {
    if (previous === undefined) {
      delete process.env.ALLOW_DEV_AUTH_BYPASS;
    } else {
      process.env.ALLOW_DEV_AUTH_BYPASS = previous;
    }
  }
});

test('requireAuth rejects requests without bearer token when bypass is disabled', async () => {
  const previous = process.env.ALLOW_DEV_AUTH_BYPASS;
  delete process.env.ALLOW_DEV_AUTH_BYPASS;

  const req = {
    headers: {},
  };
  const res = createResponseRecorder();
  let nextCalled = false;

  try {
    await requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'missing_bearer_token' });
  } finally {
    if (previous === undefined) {
      delete process.env.ALLOW_DEV_AUTH_BYPASS;
    } else {
      process.env.ALLOW_DEV_AUTH_BYPASS = previous;
    }
  }
});

test('getDevUidFromHeaders normalizes valid x-dev-uid input', () => {
  assert.equal(getDevUidFromHeaders({ 'x-dev-uid': ' uid_parent_1 ' }), 'uid_parent_1');
  assert.equal(getDevUidFromHeaders({}), null);
});

test('getDevUidFromSocketAuth normalizes valid devUid auth input', () => {
  assert.equal(getDevUidFromSocketAuth({ devUid: ' uid_child_1 ' }), 'uid_child_1');
  assert.equal(getDevUidFromSocketAuth({}), null);
});
