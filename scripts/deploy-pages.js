const { spawnSync } = require('child_process');

const target = process.argv[2];

const targetConfig = {
  landing: {
    verifyScript: 'verify:landing',
    projectName: 'pulse-landing',
    domain: 'https://pulse-messenger.com',
    label: 'landing',
    env: {
      REACT_APP_BACKEND_URL: 'https://api.pulse-messenger.com',
      REACT_APP_WEB_APP_URL: 'https://web.pulse-messenger.com',
    },
  },
  webapp: {
    verifyScript: 'verify:webapp',
    projectName: 'pulse-frontend',
    domain: 'https://web.pulse-messenger.com',
    label: 'webapp',
    env: {
      REACT_APP_BACKEND_URL: 'https://api.pulse-messenger.com',
      REACT_APP_WEB_APP_URL: 'https://web.pulse-messenger.com',
    },
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

console.log(`[Pulse] Deploying build/ to Cloudflare Pages project "${config.projectName}"...`);
run('npx', ['wrangler', 'pages', 'deploy', 'build', '--project-name', config.projectName, '--branch', 'main']);

console.log(`[Pulse] Done. Expected live target: ${config.domain}`);
