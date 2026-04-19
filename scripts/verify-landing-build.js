const fs = require('fs');
const path = require('path');

const jsDir = path.join(process.cwd(), 'build', 'static', 'js');

const forbiddenPatterns = [
  'bootstrapDevice',
  'pulse_e2ee',
  'secureKeyStore',
  'ChatScreen',
  'ParentDashboard',
  'CallOverlay',
  'firebase/auth',
  'AuthModal',
  'ParentAuthModal',
];

function collectJsFiles(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Build output not found: ${dir}`);
  }

  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => path.join(dir, file));
}

const violations = [];

for (const filePath of collectJsFiles(jsDir)) {
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (contents.includes(pattern)) {
      violations.push(`${path.relative(process.cwd(), filePath)} contains ${pattern}`);
    }
  }
}

if (violations.length) {
  console.error('Landing build contains webapp-only code:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log('Landing build is clean: no webapp-only auth, E2EE, chat or call code found.');
