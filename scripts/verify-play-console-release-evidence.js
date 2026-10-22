const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifest = require(path.join(
  root,
  'security/android-release-notices/release-1.0.24-v80.json',
));
const plan = require(path.join(root, manifest.release.dataSafetyResponsePlanPath));

function fail(message) {
  throw new Error(message);
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) fail('CSV eindigt binnen een aangehaalde waarde.');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function loadAnswers(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(raw);
  const expectedHeader = [
    'Question ID (machine readable)',
    'Response ID (machine readable)',
    'Response value',
    'Answer requirement',
    'Human-friendly question label',
  ];
  if (rows.length < 2 || expectedHeader.some((value, index) => rows[0][index] !== value)) {
    fail('Onbekend Google Play Data Safety CSV-formaat.');
  }

  const answers = rows.slice(1).map((columns) => ({
    questionId: columns[0] || '',
    responseId: columns[1] || '',
    value: (columns[2] || '').trim().toUpperCase(),
  }));
  const byKey = new Map();
  for (const answer of answers) {
    const key = `${answer.questionId}\u0000${answer.responseId}`;
    if (byKey.has(key)) fail(`Dubbele Console-antwoordrij: ${answer.questionId}/${answer.responseId}`);
    byKey.set(key, answer);
  }
  return {
    answers,
    byKey,
    sha256: crypto.createHash('sha256').update(raw).digest('hex'),
  };
}

function requireAnswer(evidence, questionId, responseId = '') {
  const answer = evidence.byKey.get(`${questionId}\u0000${responseId}`);
  if (!answer) fail(`Console-antwoordrij ontbreekt: ${questionId}/${responseId}`);
  return answer;
}

function isTrue(answer) {
  return answer.value === 'TRUE';
}

function assertBoolean(evidence, questionId, responseId, expected) {
  const answer = requireAnswer(evidence, questionId, responseId);
  if (answer.value !== 'TRUE' && answer.value !== 'FALSE' && answer.value !== '') {
    fail(`Ongeldige Console-antwoordwaarde: ${questionId}/${responseId}`);
  }
  if (isTrue(answer) !== expected) {
    fail(`Console-antwoord wijkt af: ${questionId}/${responseId}`);
  }
}

function assertSelectedResponses(evidence, questionId, expectedResponseIds) {
  const actual = evidence.answers
    .filter((answer) => answer.questionId === questionId && isTrue(answer))
    .map((answer) => answer.responseId)
    .sort();
  const expected = [...expectedResponseIds].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`Geselecteerde Console-antwoorden wijken af: ${questionId}`);
  }
}

function validateTemplate(evidence) {
  for (const questionId of Object.keys(plan.topLevelCandidate)) {
    requireAnswer(evidence, questionId);
  }
  for (const dataType of plan.dataTypes) {
    const typeSelection = evidence.answers.find(
      (answer) => answer.questionId.startsWith('PSL_DATA_TYPES_') &&
        answer.responseId === dataType.id,
    );
    if (!typeSelection) fail(`Data Safety-type ontbreekt in Console-sjabloon: ${dataType.id}`);
    requireAnswer(
      evidence,
      `PSL_DATA_USAGE_RESPONSES:${dataType.id}:PSL_DATA_USAGE_COLLECTION_AND_SHARING`,
      'PSL_DATA_USAGE_ONLY_COLLECTED',
    );
    requireAnswer(
      evidence,
      `PSL_DATA_USAGE_RESPONSES:${dataType.id}:PSL_DATA_USAGE_COLLECTION_AND_SHARING`,
      'PSL_DATA_USAGE_ONLY_SHARED',
    );
    requireAnswer(evidence, `PSL_DATA_USAGE_RESPONSES:${dataType.id}:PSL_DATA_USAGE_EPHEMERAL`);
    requireAnswer(
      evidence,
      `PSL_DATA_USAGE_RESPONSES:${dataType.id}:DATA_USAGE_USER_CONTROL`,
      'PSL_DATA_USAGE_USER_CONTROL_OPTIONAL',
    );
    requireAnswer(
      evidence,
      `PSL_DATA_USAGE_RESPONSES:${dataType.id}:DATA_USAGE_USER_CONTROL`,
      'PSL_DATA_USAGE_USER_CONTROL_REQUIRED',
    );
    for (const purpose of dataType.purposes) {
      requireAnswer(
        evidence,
        `PSL_DATA_USAGE_RESPONSES:${dataType.id}:DATA_USAGE_COLLECTION_PURPOSE`,
        purpose,
      );
    }
  }
}

function verifyAnswers(evidence) {
  validateTemplate(evidence);
  for (const [questionId, expected] of Object.entries(plan.topLevelCandidate)) {
    assertBoolean(evidence, questionId, '', expected);
  }

  const selectedTypes = plan.dataTypes.map((dataType) => dataType.id);
  const actualTypes = evidence.answers
    .filter((answer) => answer.questionId.startsWith('PSL_DATA_TYPES_') && isTrue(answer))
    .map((answer) => answer.responseId)
    .sort();
  if (JSON.stringify(actualTypes) !== JSON.stringify([...selectedTypes].sort())) {
    fail('De geselecteerde Data Safety-gegevenstypen wijken af van het antwoordplan.');
  }

  for (const dataType of plan.dataTypes) {
    const prefix = `PSL_DATA_USAGE_RESPONSES:${dataType.id}`;
    assertBoolean(
      evidence,
      `${prefix}:PSL_DATA_USAGE_COLLECTION_AND_SHARING`,
      'PSL_DATA_USAGE_ONLY_COLLECTED',
      dataType.collected,
    );
    assertBoolean(
      evidence,
      `${prefix}:PSL_DATA_USAGE_COLLECTION_AND_SHARING`,
      'PSL_DATA_USAGE_ONLY_SHARED',
      dataType.shared,
    );
    assertBoolean(evidence, `${prefix}:PSL_DATA_USAGE_EPHEMERAL`, '', dataType.ephemeral);
    assertSelectedResponses(
      evidence,
      `${prefix}:DATA_USAGE_USER_CONTROL`,
      [dataType.control === 'optional'
        ? 'PSL_DATA_USAGE_USER_CONTROL_OPTIONAL'
        : 'PSL_DATA_USAGE_USER_CONTROL_REQUIRED'],
    );
    assertSelectedResponses(
      evidence,
      `${prefix}:DATA_USAGE_COLLECTION_PURPOSE`,
      dataType.purposes,
    );
    assertSelectedResponses(evidence, `${prefix}:DATA_USAGE_SHARING_PURPOSE`, []);
  }
}

function normalizeFingerprint(value) {
  const normalized = String(value || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (!/^[A-F0-9]{64}$/.test(normalized)) fail('Uploadcertificaat-fingerprint is geen SHA-256-waarde.');
  return normalized.match(/.{2}/g).join(':');
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
  const csvPath = readArgument('--csv') || process.env.PULSE_PLAY_DATA_SAFETY_CSV;
  if (!csvPath) {
    fail('Gebruik --csv <Play Console-export.csv> of PULSE_PLAY_DATA_SAFETY_CSV.');
  }
  const evidence = loadAnswers(path.resolve(csvPath));
  if (process.argv.includes('--validate-template')) {
    validateTemplate(evidence);
    console.log(
      `Google Play Data Safety-sjabloon: OK (${plan.dataTypes.length} geplande typen, SHA-256 ${evidence.sha256})`,
    );
    return;
  }

  verifyAnswers(evidence);
  const suppliedFingerprint = normalizeFingerprint(
    readArgument('--upload-cert-sha256') || process.env.PULSE_PLAY_UPLOAD_CERT_SHA256,
  );
  if (suppliedFingerprint !== manifest.release.localUploadCertificateSha256) {
    fail('Play Console-uploadcertificaat wijkt af van de lokale release-uploadkey.');
  }
  console.log(
    `Play Console-releasebewijs: OK (CSV SHA-256 ${evidence.sha256}; uploadcertificaat komt overeen)`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { loadAnswers, normalizeFingerprint, parseCsv, validateTemplate, verifyAnswers };
