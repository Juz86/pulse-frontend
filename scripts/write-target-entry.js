const fs = require('fs');
const path = require('path');

const target = process.env.REACT_APP_SITE_TARGET === 'landing' ? 'landing' : 'webapp';
const generatedDir = path.join(process.cwd(), 'src', 'generated');
const targetEntryPath = path.join(generatedDir, 'targetApp.js');
const sourceModule = target === 'landing' ? '../LandingApp' : '../App';

fs.mkdirSync(generatedDir, { recursive: true });
fs.writeFileSync(targetEntryPath, `export { default } from '${sourceModule}';\n`, 'utf8');

console.log(`Wrote ${target} target entry to src/generated/targetApp.js.`);
