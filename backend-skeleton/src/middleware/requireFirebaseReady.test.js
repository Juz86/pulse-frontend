import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseReady } from './requireFirebaseReady.js';

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

test('requireFirebaseReady returns 503 when firebase config is absent', () => {
  const previous = {
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  };

  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.GCLOUD_PROJECT;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.FIREBASE_CLIENT_EMAIL;
  delete process.env.FIREBASE_PRIVATE_KEY;

  const req = { requestId: 'req_123' };
  const res = createResponseRecorder();
  let nextCalled = false;

  try {
    requireFirebaseReady(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, 'firebase_not_configured');
    assert.equal(res.body.requestId, 'req_123');
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
});

test('requireFirebaseReady calls next when emulator config is present', () => {
  const previousHost = process.env.FIRESTORE_EMULATOR_HOST;
  const previousProject = process.env.FIREBASE_PROJECT_ID;

  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_PROJECT_ID = 'demo-pulse';

  const req = { requestId: 'req_456' };
  const res = createResponseRecorder();
  let nextCalled = false;

  try {
    requireFirebaseReady(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.body, null);
  } finally {
    if (previousHost === undefined) {
      delete process.env.FIRESTORE_EMULATOR_HOST;
    } else {
      process.env.FIRESTORE_EMULATOR_HOST = previousHost;
    }

    if (previousProject === undefined) {
      delete process.env.FIREBASE_PROJECT_ID;
    } else {
      process.env.FIREBASE_PROJECT_ID = previousProject;
    }
  }
});
