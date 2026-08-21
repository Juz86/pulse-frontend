const { spawnSync } = require('child_process');

const target = process.argv[2];
const defaults = {
  marketingUrl: process.env.REACT_APP_MARKETING_URL || 'https://pulse-messenger.com',
  webAppUrl:
    process.env.REACT_APP_WEB_APP_URL ||
    process.env.REACT_APP_APP_URL ||
    'https://web.pulse-messenger.com',
  apiUrl: process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'https://api.pulse-messenger.com',
};
const serviceDefaults = {
  REACT_APP_APP_URL: defaults.webAppUrl,
  REACT_APP_MARKETING_URL: defaults.marketingUrl,
  REACT_APP_API_URL: defaults.apiUrl,
  REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL || defaults.apiUrl,
  REACT_APP_WS_URL: process.env.REACT_APP_WS_URL || defaults.apiUrl,
  REACT_APP_SIGNALING_URL: process.env.REACT_APP_SIGNALING_URL || process.env.REACT_APP_WS_URL || defaults.apiUrl,
  REACT_APP_RTC_CONFIG_URL: process.env.REACT_APP_RTC_CONFIG_URL || defaults.apiUrl,
  REACT_APP_WEB_APP_URL: defaults.webAppUrl,
  REACT_APP_E2EE_MODE: process.env.REACT_APP_E2EE_MODE || 'mock',
  REACT_APP_E2EE_TRANSPORT: process.env.REACT_APP_E2EE_TRANSPORT || 'socket',
};

const targetConfig = {
  landing: {
    verifyScript: 'verify:landing',
    projectName: 'pulse-landing',
    domain: defaults.marketingUrl,
    label: 'landing',
    env: serviceDefaults,
  },
  webapp: {
    verifyScript: 'verify:webapp',
    projectName: 'pulse-frontend',
    domain: defaults.webAppUrl,
    label: 'webapp',
    env: serviceDefaults,
  },
};

if (!targetConfig[target]) {
  console.error('Usage: node scripts/deploy-pages.js <landing|webapp>');
  process.exit(1);
}

const config = targetConfig[target];

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      ...config.env,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`[Pulse] Verifying ${config.label} target before deploy...`);
run('npm', ['run', config.verifyScript]);

if (target === 'webapp') {
  console.log('[Pulse] Packaging signed native web update when a signing key is configured...');
  run('node', ['scripts/package-native-update.js']);
}

console.log(`[Pulse] Deploying build/ to Cloudflare Pages project "${config.projectName}"...`);
run('npx', ['wrangler', 'pages', 'deploy', 'build', '--project-name', config.projectName, '--branch', 'main']);

console.log(`[Pulse] Done. Expected live target: ${config.domain}`);
