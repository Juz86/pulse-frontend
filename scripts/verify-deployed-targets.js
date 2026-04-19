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

function fetchResponse(url, expectedHost, method = 'HEAD', redirectsRemaining = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method }, (response) => {
      const location = response.headers.location || '';

      if (response.statusCode >= 300 && response.statusCode < 400 && location) {
        const redirectUrl = new URL(location, url);

        response.resume();

        if (redirectUrl.protocol !== 'https:' || redirectUrl.hostname !== expectedHost) {
          resolve({
            headers: response.headers,
            statusCode: response.statusCode,
            finalUrl: url,
            redirectProtocol: redirectUrl.protocol,
            redirectHost: redirectUrl.hostname,
          });
          return;
        }

        if (redirectsRemaining <= 0) {
          reject(new Error(`Too many redirects while checking ${url}`));
          return;
        }

        fetchResponse(redirectUrl, expectedHost, method, redirectsRemaining - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        if (body.length < 100000) body += chunk;
      });
      response.on('end', () => {
        resolve({ body, headers: response.headers, statusCode: response.statusCode, finalUrl: url });
      });
    });

    request.setTimeout(10000, () => {
      request.destroy(new Error(`Timed out while checking ${url}`));
    });

    request.on('error', reject);
    request.end();
  });
}

async function verifyTarget(target, fetcher = fetchResponse) {
  const targetUrl = parseHttpsUrl(target.name, target.url);
  const expectedHost = targetUrl.hostname;
  const { headers, finalUrl, redirectHost, redirectProtocol } = await fetcher(targetUrl, expectedHost, 'HEAD');
  const csp = headers['content-security-policy'] || '';
  const violations = [];

  if (redirectHost) {
    violations.push(`${target.name}: redirects to unexpected URL ${redirectProtocol}//${redirectHost}`);
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

  const page = await fetcher(targetUrl, expectedHost, 'GET');
  const contentType = page.headers['content-type'] || '';

  if (page.redirectHost) {
    violations.push(`${target.name}: page redirects to unexpected URL ${page.redirectProtocol}//${page.redirectHost}`);
  }

  if (page.statusCode < 200 || page.statusCode >= 300) {
    violations.push(`${target.name}: expected live page status 2xx, got ${page.statusCode}`);
  }

  if (!contentType.includes('text/html')) {
    violations.push(`${target.name}: expected text/html content-type, got "${contentType || 'missing'}"`);
  }

  if (!page.body.includes('<!doctype html') && !page.body.includes('<!DOCTYPE html')) {
    violations.push(`${target.name}: live page response does not look like the Pulse HTML document`);
  }

  return violations;
}

async function verifyTargets(targetsToVerify = targets) {
  const allViolations = [];

  for (const target of targetsToVerify) {
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

  return allViolations;
}

function getRemediationHints(violations) {
  const hints = [];
  const hasLandingWebappSources = violations.some(
    (violation) => violation.startsWith('landing: CSP must not include')
  );
  const hasWebappDnsFailure = violations.some(
    (violation) => violation.startsWith('webapp: getaddrinfo ENOTFOUND')
  );
  const hasCrossTargetRedirect = violations.some(
    (violation) => violation.includes('redirects to unexpected URL')
  );

  if (hasLandingWebappSources) {
    hints.push(
      'landing: Cloudflare Pages gebruikt waarschijnlijk de webapp-build. Zet build command op `npm run build:landing` en `REACT_APP_SITE_TARGET=landing`.'
    );
  }

  if (hasWebappDnsFailure) {
    hints.push(
      'webapp: `web.pulse-messenger.com` bestaat DNS-technisch nog niet. Voeg dit custom domain toe aan de webapp Pages target en controleer het DNS-record.'
    );
  }

  if (hasCrossTargetRedirect) {
    hints.push(
      'redirect: controleer Cloudflare custom domains en redirects; landing en webapp mogen niet naar elkaars host doorsturen.'
    );
  }

  return hints;
}

async function main() {
  const allViolations = await verifyTargets();

  if (allViolations.length) {
    console.error('Deployed target verification failed:');
    allViolations.forEach((violation) => console.error(`- ${violation}`));
    const hints = getRemediationHints(allViolations);
    if (hints.length) {
      console.error('\nSuggested fixes:');
      hints.forEach((hint) => console.error(`- ${hint}`));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  fetchResponse,
  getRemediationHints,
  parseHttpsUrl,
  verifyTarget,
  verifyTargets,
};
