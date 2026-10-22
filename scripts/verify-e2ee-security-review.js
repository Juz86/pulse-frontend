const { createHash } = require('crypto');
const { execFileSync } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const reviewRoot = path.join(projectRoot, 'security/e2ee/browser-provider-review');
const attestationPath = path.join(reviewRoot, 'review-attestation.json');
const candidate = JSON.parse(readFileSync(path.join(reviewRoot, 'candidate.json'), 'utf8'));
const reviewSubject = JSON.parse(readFileSync(path.join(reviewRoot, 'review-subject.json'), 'utf8'));
const runtime = JSON.parse(readFileSync(
  path.join(projectRoot, 'security/e2ee/browser-provider-runtime.json'),
  'utf8',
));

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function gitHasCommit(commit) {
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], {
      cwd: projectRoot,
      stdio: 'ignore',
    });
    execFileSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], {
      cwd: projectRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

requireValue(
  existsSync(attestationPath),
  'Onafhankelijk reviewbewijs ontbreekt: review-attestation.json is niet aanwezig.',
);

const attestation = JSON.parse(readFileSync(attestationPath, 'utf8'));
const commitPattern = /^[0-9a-f]{40}$/;
const hashPattern = /^[0-9a-f]{64}$/;
requireValue(attestation.status === 'approved', 'De securityreview is niet goedgekeurd.');
requireValue(
  reviewSubject.status === 'independent_review_approved',
  'De bevroren reviewbasis is nog niet als onafhankelijk goedgekeurd gemarkeerd.',
);
requireValue(attestation.reviewer?.independent === true, 'De reviewer is niet als onafhankelijk vastgelegd.');
['name', 'organization', 'contact'].forEach((field) => {
  requireValue(
    typeof attestation.reviewer?.[field] === 'string'
      && attestation.reviewer[field].trim().length > 0,
    `Reviewer ${field} ontbreekt.`,
  );
});
requireValue(/^\d{4}-\d{2}-\d{2}$/.test(attestation.reviewedAt || ''), 'reviewedAt is ongeldig.');
['frontendCommit', 'backendCommit', 'upstreamCommit', 'libsignalCommit'].forEach((field) => {
  requireValue(commitPattern.test(attestation.scope?.[field] || ''), `Reviewscope ${field} is ongeldig.`);
});
requireValue(
  gitHasCommit(attestation.scope.frontendCommit),
  'De beoordeelde frontendcommit bestaat niet of is geen voorouder van HEAD.',
);
requireValue(
  attestation.scope.frontendCommit === reviewSubject.scope.frontendCommit,
  'De beoordeelde frontendcommit wijkt af van de bevroren reviewbasis.',
);
requireValue(
  attestation.scope.backendCommit === reviewSubject.scope.backendCommit,
  'De beoordeelde backendcommit wijkt af van de bevroren reviewbasis.',
);
requireValue(
  attestation.scope.upstreamCommit === candidate.upstream.commit,
  'De beoordeelde upstreamcommit wijkt af van de kandidaat.',
);
requireValue(
  attestation.scope.libsignalCommit === candidate.libsignal.commit,
  'De beoordeelde libsignalcommit wijkt af van de kandidaat.',
);
requireValue(
  attestation.scope.upstreamCommit === reviewSubject.scope.upstreamCommit,
  'De beoordeelde upstreamcommit wijkt af van de bevroren reviewbasis.',
);
requireValue(
  attestation.scope.libsignalCommit === reviewSubject.scope.libsignalCommit,
  'De beoordeelde libsignalcommit wijkt af van de bevroren reviewbasis.',
);
requireValue(attestation.rebuild?.performed === true, 'Een onafhankelijke rebuild is niet bevestigd.');
const wasmPath = path.resolve(projectRoot, runtime.artifacts.wasm.path);
const javascriptPath = path.resolve(projectRoot, runtime.artifacts.javascript.path);
requireValue(sha256(wasmPath) === runtime.artifacts.wasm.sha256, 'Het gebundelde WASM-artifact is gewijzigd.');
requireValue(
  sha256(javascriptPath) === runtime.artifacts.javascript.sha256,
  'Het gebundelde JavaScript-artifact is gewijzigd.',
);
requireValue(
  runtime.artifacts.wasm.sha256 === candidate.outputs.wasmSha256,
  'Runtime- en kandidaathash voor WASM verschillen.',
);
requireValue(
  runtime.artifacts.javascript.sha256 === candidate.outputs.javascriptSha256,
  'Runtime- en kandidaathash voor JavaScript verschillen.',
);
requireValue(
  runtime.artifacts.wasm.sha256 === reviewSubject.artifacts.wasmSha256,
  'De WASM-hash wijkt af van de bevroren reviewbasis.',
);
requireValue(
  runtime.artifacts.javascript.sha256 === reviewSubject.artifacts.javascriptSha256,
  'De JavaScript-hash wijkt af van de bevroren reviewbasis.',
);
requireValue(
  attestation.rebuild.wasmSha256 === runtime.artifacts.wasm.sha256,
  'De onafhankelijk gebouwde WASM-hash wijkt af.',
);
requireValue(
  attestation.rebuild.javascriptSha256 === runtime.artifacts.javascript.sha256,
  'De onafhankelijk gebouwde JavaScript-hash wijkt af.',
);
['unit', 'browserWorker', 'tamper', 'replay', 'androidBrowserInterop'].forEach((test) => {
  requireValue(attestation.tests?.[test] === true, `Verplichte reviewtest ${test} is niet geslaagd.`);
});
requireValue(attestation.findings?.openCritical === 0, 'Er staan kritieke reviewbevindingen open.');
requireValue(attestation.findings?.openHigh === 0, 'Er staan hoge reviewbevindingen open.');
requireValue(Number.isInteger(attestation.findings?.openMedium), 'Aantal middelhoge bevindingen ontbreekt.');
requireValue(Number.isInteger(attestation.findings?.openLow), 'Aantal lage bevindingen ontbreekt.');

const reportPath = path.resolve(projectRoot, attestation.report?.path || '');
requireValue(
  reportPath.startsWith(`${path.join(reviewRoot, 'evidence')}${path.sep}`),
  'Het reviewrapport staat niet in de afgeschermde evidence-map.',
);
requireValue(existsSync(reportPath), 'Het inhoudelijke onafhankelijke reviewrapport ontbreekt.');
requireValue(hashPattern.test(attestation.report?.sha256 || ''), 'De rapporthash is ongeldig.');
requireValue(sha256(reportPath) === attestation.report.sha256, 'De rapporthash komt niet overeen.');
const reportText = readFileSync(reportPath, 'utf8');
requireValue(
  !reportText.includes('DRAFT_AWAITING_INDEPENDENT_REVIEWER_COMPLETION'),
  'Het onafhankelijke reviewrapport heeft nog draftstatus.',
);
requireValue(
  !reportText.includes('`REQUIRED`') && !reportText.includes('REQUIRED:'),
  'Het onafhankelijke reviewrapport bevat nog verplichte invulvelden.',
);

console.log('Independent E2EE security review evidence: OK');
console.log(`Reviewer: ${attestation.reviewer.name} (${attestation.reviewer.organization})`);
console.log(`Frontend: ${attestation.scope.frontendCommit}`);
console.log(`Backend: ${attestation.scope.backendCommit}`);
console.log(`Report SHA-256: ${attestation.report.sha256}`);
