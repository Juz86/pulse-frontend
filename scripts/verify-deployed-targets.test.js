const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  getRemediationHints,
  getSelectedTargets,
  parseHttpsUrl,
  verifyTarget,
} = require('./verify-deployed-targets');

const htmlResponse = {
  body: '<!doctype html><html><head><meta name="pulse-target" content="landing" /><title>Pulse</title></head><body></body></html>',
  headers: { 'content-type': 'text/html; charset=utf-8' },
  statusCode: 200,
  finalUrl: new URL('https://pulse-messenger.com'),
};

function createFetcher({ csp = '', page = htmlResponse, head = {} } = {}) {
  return async (url, expectedHost, method) => {
    if (url.hostname !== expectedHost) {
      throw new Error(`Unexpected host ${url.hostname}`);
    }

    if (method === 'HEAD') {
      return {
        headers: { 'content-security-policy': csp, ...(head.headers || {}) },
        statusCode: head.statusCode || 200,
        finalUrl: url,
        redirectHost: head.redirectHost,
        redirectProtocol: head.redirectProtocol,
      };
    }

    return {
      ...page,
      headers: page.headers || {},
      finalUrl: page.finalUrl || url,
    };
  };
}

test('rejects non-HTTPS target URLs', () => {
  assert.throws(
    () => parseHttpsUrl('landing', 'http://pulse-messenger.com'),
    /URL must use https/
  );
});

test('landing target rejects webapp-only CSP sources', async () => {
  const violations = await verifyTarget(
    {
      name: 'landing',
      url: 'https://pulse-messenger.com',
      forbidden: ['api.pulse-messenger.com'],
      required: [],
    },
    createFetcher({ csp: "default-src 'self'; connect-src https://api.pulse-messenger.com" })
  );

  assert.deepEqual(violations, ['landing: CSP must not include api.pulse-messenger.com']);
});

test('webapp target requires app CSP sources', async () => {
  const violations = await verifyTarget(
    {
      name: 'webapp',
      url: 'https://web.pulse-messenger.com',
      forbidden: [],
      required: ['api.pulse-messenger.com'],
    },
    createFetcher({ csp: "default-src 'self'" })
  );

  assert.deepEqual(violations, ['webapp: CSP must include api.pulse-messenger.com']);
});

test('target rejects cross-host redirects', async () => {
  const violations = await verifyTarget(
    {
      name: 'landing',
      url: 'https://pulse-messenger.com',
      forbidden: [],
      required: [],
    },
    createFetcher({
      csp: "default-src 'self'",
      head: {
        redirectHost: 'web.pulse-messenger.com',
        redirectProtocol: 'https:',
      },
    })
  );

  assert.equal(violations[0], 'landing: redirects to unexpected URL https://web.pulse-messenger.com');
});

test('target rejects non-HTML live pages', async () => {
  const violations = await verifyTarget(
    {
      name: 'landing',
      url: 'https://pulse-messenger.com',
      forbidden: [],
      required: [],
    },
    createFetcher({
      csp: "default-src 'self'",
      page: {
        body: '{"ok":true}',
        headers: { 'content-type': 'application/json' },
        statusCode: 200,
        finalUrl: new URL('https://pulse-messenger.com'),
      },
    })
  );

  assert.deepEqual(violations, [
    'landing: expected text/html content-type, got "application/json"',
    'landing: live page response does not look like the Pulse HTML document',
  ]);
});

test('target rejects missing build marker on live page', async () => {
  const violations = await verifyTarget(
    {
      name: 'webapp',
      url: 'https://web.pulse-messenger.com',
      expectedMarker: '<meta name="pulse-target" content="webapp"',
      forbidden: [],
      required: [],
    },
    createFetcher({
      csp: "default-src 'self'",
      page: {
        body: '<!doctype html><html><head><title>Pulse</title></head><body></body></html>',
        headers: { 'content-type': 'text/html; charset=utf-8' },
        statusCode: 200,
        finalUrl: new URL('https://web.pulse-messenger.com'),
      },
    })
  );

  assert.deepEqual(violations, [
    'webapp: live page is missing target marker <meta name="pulse-target" content="webapp"',
  ]);
});

test('returns actionable hints for common Cloudflare target mistakes', () => {
  const hints = getRemediationHints([
    'landing: CSP must not include api.pulse-messenger.com',
    'webapp: getaddrinfo ENOTFOUND web.pulse-messenger.com',
    'webapp: CSP must include api.pulse-messenger.com',
    'webapp: live page is missing target marker <meta name="pulse-target" content="webapp"',
  ]);

  assert.equal(hints.length, 4);
  assert.match(hints[0], /npm run build:landing/);
  assert.match(hints[1], /custom domain/);
  assert.match(hints[2], /npm run build:webapp/);
  assert.match(hints[3], /target-marker/);
});

test('supports selecting a single deployed target', () => {
  assert.deepEqual(
    getSelectedTargets('landing').map((target) => target.name),
    ['landing']
  );
  assert.deepEqual(
    getSelectedTargets('webapp').map((target) => target.name),
    ['webapp']
  );
  assert.equal(getSelectedTargets('all').length, 2);
});

test('rejects unknown deployed target selection', () => {
  assert.throws(
    () => getSelectedTargets('marketing'),
    /Unknown PULSE_VERIFY_TARGET/
  );
});
