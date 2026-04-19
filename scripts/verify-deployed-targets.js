const https = require('https');

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

function fetchHeaders(url) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method: 'HEAD' }, (response) => {
      response.resume();
      resolve(response.headers);
    });

    request.setTimeout(10000, () => {
      request.destroy(new Error(`Timed out while checking ${url}`));
    });

    request.on('error', reject);
    request.end();
  });
}

async function verifyTarget(target) {
  const headers = await fetchHeaders(target.url);
  const csp = headers['content-security-policy'] || '';

  if (!csp) {
    return [`${target.name}: missing content-security-policy header on ${target.url}`];
  }

  const violations = [];

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
