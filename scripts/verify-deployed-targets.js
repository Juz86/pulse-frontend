const https = require('https');

const MAX_REDIRECTS = 5;

const targets = [
  {
    name: 'landing',
    url: process.env.PULSE_LANDING_URL || 'https://pulse-messenger.com',
    forbidden: [
      'api.pulse-messenger.com',
      'firebaseio.com',
      'firebaseapp.com',
      'fcm.googleapis.com',
      'firebasestorage.googleapis.com',
      'wss://api.pulse-messenger.com',
    ],
    required: [],
  },
  {
    name: 'webapp',
    url: process.env.PULSE_WEBAPP_URL || 'https://web.pulse-messenger.com',
    forbidden: [],
    required: [
      'api.pulse-messenger.com',
      'firebaseio.com',
      'firebaseapp.com',
      'fcm.googleapis.com',
      'firebasestorage.googleapis.com',
      'wss://api.pulse-messenger.com',
    ],
  },
];

function parseHttpsUrl(name, url) {
  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch (error) {
    throw new Error(`${name}: invalid URL "${url}"`);
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error(`${name}: URL must use https, got ${parsedUrl.protocol}`);
  }

  return parsedUrl;
}

function fetchHeaders(url, expectedHost, redirectsRemaining = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method: 'HEAD' }, (response) => {
      const location = response.headers.location || '';

      if (response.statusCode >= 300 && response.statusCode < 400 && location) {
        const redirectUrl = new URL(location, url);

        response.resume();

        if (redirectUrl.hostname !== expectedHost) {
          resolve({
            headers: response.headers,
            statusCode: response.statusCode,
            finalUrl: url,
            redirectHost: redirectUrl.hostname,
          });
          return;
        }

        if (redirectsRemaining <= 0) {
          reject(new Error(`Too many redirects while checking ${url}`));
          return;
        }

        fetchHeaders(redirectUrl, expectedHost, redirectsRemaining - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      response.resume();
      resolve({ headers: response.headers, statusCode: response.statusCode, finalUrl: url });
    });

    request.setTimeout(10000, () => {
      request.destroy(new Error(`Timed out while checking ${url}`));
    });

    request.on('error', reject);
    request.end();
  });
}

async function verifyTarget(target) {
  const targetUrl = parseHttpsUrl(target.name, target.url);
  const expectedHost = targetUrl.hostname;
  const { headers, finalUrl, redirectHost } = await fetchHeaders(targetUrl, expectedHost);
  const csp = headers['content-security-policy'] || '';
  const violations = [];

  if (redirectHost) {
    violations.push(`${target.name}: redirects to unexpected host ${redirectHost}`);
  }

  if (!csp) {
    violations.push(`${target.name}: missing content-security-policy header on ${finalUrl.href}`);
  }

  for (const source of target.forbidden) {
    if (csp.includes(source)) {
      violations.push(`${target.name}: CSP must not include ${source}`);
    }
  }

  for (const source of target.required) {
    if (!csp.includes(source)) {
      violations.push(`${target.name}: CSP must include ${source}`);
    }
  }

  return violations;
}

(async () => {
  const allViolations = [];

  for (const target of targets) {
    try {
      const violations = await verifyTarget(target);
      if (violations.length) {
        allViolations.push(...violations);
      } else {
        console.log(`${target.name} deployment headers verified: ${target.url}`);
      }
    } catch (error) {
      allViolations.push(`${target.name}: ${error.message}`);
    }
  }

  if (allViolations.length) {
    console.error('Deployed target verification failed:');
    allViolations.forEach((violation) => console.error(`- ${violation}`));
    process.exit(1);
  }
})();
