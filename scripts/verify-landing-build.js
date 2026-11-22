const fs = require('fs');
const path = require('path');

const jsDir = path.join(process.cwd(), 'build', 'static', 'js');
const staticMarketingRoutes = [
  ['index.html', 'Veilig chatten voor elk kind'],
  ['functies/index.html', 'Alles voor veilig contact'],
  ['ouderlijk-toezicht/index.html', 'Overzicht en controle voor ouders'],
  ['hoe-werkt-het/index.html', 'Zo werkt Pulse'],
  ['privacy-first/index.html', 'Privacy staat voorop'],
];

const forbiddenPatterns = [
  'bootstrapDevice',
  'pulse_e2ee',
  'secureKeyStore',
  'ChatScreen',
  'ParentDashboard',
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

const staticPageViolations = [];
for (const [relativePath, expectedHeading] of staticMarketingRoutes) {
  const pagePath = path.join(process.cwd(), 'build', relativePath);
  if (!fs.existsSync(pagePath)) {
    staticPageViolations.push(`${relativePath} ontbreekt`);
    continue;
  }
  const content = fs.readFileSync(pagePath, 'utf8');
  if (!content.includes(expectedHeading) || !content.includes('application/ld+json')) {
    staticPageViolations.push(`${relativePath} bevat geen verwachte statische inhoud of structured data`);
  }
}

if (staticPageViolations.length) {
  console.error('Landing build mist serverleesbare marketingpagina’s:');
  staticPageViolations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log('Landing build is clean: no webapp-only auth, E2EE or chat code found.');
console.log('Landing build contains static marketing content for public routes.');
