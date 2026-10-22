# Pulse E2EE v2 Independent Delta Review Report

Document status: `DRAFT_AWAITING_INDEPENDENT_REVIEWER_COMPLETION`

Prepared on: 2026-10-22

Prepared by: Pulse implementation team

Independent reviewer: `REQUIRED`

Reviewer organization: `REQUIRED`

Reviewer contact: `REQUIRED`

Independent review date: `REQUIRED`

Final decision: `REQUIRED: APPROVED OR REJECTED`

This draft assembles the reproducible evidence and the exact review questions.
It is not an independent approval. The reviewer must independently rebuild,
execute the tests, record findings, complete the decision sections, and attest
the resulting report hash before a production pilot can start.

## 1. Review Subject

The frozen candidate is defined by
`security/e2ee/browser-provider-review/review-subject.json`:

| Component | Frozen value |
| --- | --- |
| Frontend | `2904b70ad10fcb49b3967d668bbb4c2f66e3cd9d` |
| Backend | `b930e2b165e7784778efd333ae1d07d23e1b4d58` |
| signal-wasm upstream | `0a5e3cb8bf282efb3521d7cdac5476caf3fb1acd` |
| libsignal | `1738ead8a12ffe539f6309958123dadb16dc3b95` |
| WASM SHA-256 | `ce473ceb9422a801d1bd48e3764f9e52b06f13191523ba1a944e9fa0985160bc` |
| JavaScript SHA-256 | `42910a893b4a6b585622f38dbe901a307a4db954fc7eda36372153eacbc1e623` |

Previous review basis used for the delta:

| Component | Previous value |
| --- | --- |
| Frontend | `b686b7559800c44b736888f6bac9ef88a5411f6b` |
| Backend | `38c19aad1160492a6a639b14f720a5f95903f48c` |

The metadata-only frontend commits after the frozen functional commit are not
runtime scope. They bind the evidence contract to the functional commits above.

## 2. Delta Summary

### 2.1 Backend

The backend delta adds:

- explicit `disabled`, acknowledged `qa`, and allowlisted `pilot` modes;
- mandatory review-attestation hash and frontend/backend commit pins;
- equality between the reviewed backend commit and CI-provided release commit;
- non-empty user and conversation allowlists without wildcard support;
- server-side authorization on device, key-bundle, send, feed, acknowledgement,
  and envelope routes;
- recipient-account checks before key claims and ciphertext submission;
- an independent send kill switch that leaves recovery, acknowledgement, and
  revoke paths available;
- structured telemetry containing only a fixed operation, outcome class, HTTP
  status, rollout mode, and coarse duration bucket;
- a production pilot and rollback runbook.

Files in scope:

- `E2EE_V2_PRODUCTION_PILOT.md`
- `src/e2ee/v2/pilotTelemetry.js`
- `src/e2ee/v2/rolloutPolicy.js`
- `src/e2ee/v2/routes.js`
- `tests/e2ee.v2.pilotTelemetry.test.js`
- `tests/e2ee.v2.rolloutPolicy.test.js`
- `tests/routes.e2ee.v2.test.js`

### 2.2 Frontend

The frontend delta adds:

- production pilot build flags that cannot be enabled with QA mode;
- a production-host-only configuration guard;
- authenticated `/v2/pilot/status` enrollment before native or browser crypto
  bootstrap;
- no worker, Keystore bootstrap, or device registration for non-enrolled users;
- isolated QA and production binding namespaces and opaque device IDs;
- local enforcement of the send kill switch while receive and recovery remain
  available;
- validation of the pilot-status response before it reaches runtime state;
- neutral user-facing E2EE failure text instead of QA-only wording;
- an exact commit- and artifact-bound review evidence gate.

Runtime files in scope:

- `src/hooks/useAndroidE2eeV2QaRuntime.js`
- `src/hooks/useChat.js`
- `src/hooks/useConversations.js`
- `src/lib/e2ee/config.js`
- `src/lib/e2ee/v2/androidQaRuntime.js`
- `src/lib/e2ee/v2/browserDeviceBinding.js`
- `src/lib/e2ee/v2/browserE2eeWorkerClient.js`
- `src/lib/e2ee/v2/browserQaRuntime.js`
- `src/lib/e2ee/v2/pilotEnrollment.js`
- `src/lib/e2ee/v2/v2ApiClient.js`
- `src/screens/ChatScreen.js`

Associated tests and E2EE decision/status documents are also in scope.

## 3. Security Properties To Verify

The independent reviewer must record `PASS`, `FAIL`, or `NOT TESTED` for every
item and cite evidence.

| ID | Required property | Result | Evidence |
| --- | --- | --- | --- |
| DR-01 | Production E2EE is disabled by default. | `REQUIRED` | `REQUIRED` |
| DR-02 | QA mode requires explicit acknowledgement and cannot coexist with pilot mode. | `REQUIRED` | `REQUIRED` |
| DR-03 | Pilot mode fails closed for missing or malformed review pins and allowlists. | `REQUIRED` | `REQUIRED` |
| DR-04 | The deployed backend commit must equal the reviewed backend commit. | `REQUIRED` | `REQUIRED` |
| DR-05 | Non-allowlisted users and conversations cannot use any protected v2 route. | `REQUIRED` | `REQUIRED` |
| DR-06 | Every message recipient account must be allowlisted. | `REQUIRED` | `REQUIRED` |
| DR-07 | A paused send gate blocks new ciphertext without blocking feed, ack, or revoke recovery. | `REQUIRED` | `REQUIRED` |
| DR-08 | No downgrade from `v2_required` to legacy or plaintext is possible. | `REQUIRED` | `REQUIRED` |
| DR-09 | Telemetry contains no user, conversation, message, or device ID, URL, ciphertext, or plaintext. | `REQUIRED` | `REQUIRED` |
| DR-10 | Enrollment is authenticated and occurs before worker, key, or device bootstrap. | `REQUIRED` | `REQUIRED` |
| DR-11 | Non-enrolled clients remain outside the v2 runtime. | `REQUIRED` | `REQUIRED` |
| DR-12 | QA and production binding namespaces cannot be confused or reused. | `REQUIRED` | `REQUIRED` |
| DR-13 | Browser and Android receive/recovery still work while sends are paused. | `REQUIRED` | `REQUIRED` |
| DR-14 | The production host, mode, transport, and browser gates reject invalid combinations. | `REQUIRED` | `REQUIRED` |
| DR-15 | Review and artifact hashes remain bound to the frozen candidate. | `REQUIRED` | `REQUIRED` |

## 4. Implementation-Provided Evidence

These results were produced by the implementation environment and must be
repeated independently. They are evidence inputs, not reviewer conclusions.

| Evidence | Implementer result |
| --- | --- |
| Backend Jest suite | 30 suites, 207 tests passed |
| Frontend Jest suite | 29 suites, 282 tests passed |
| Frontend ESLint | Passed |
| Frontend production build | Passed |
| Browser review candidate guard | Passed |
| Browser runtime artifact guard | Passed |
| Security review evidence guard | Correctly blocked because no final attestation exists |
| Browser/WASM suite recorded by candidate | 51 passed, 0 failed, 0 ignored |
| Android-browser interoperability | Recorded as passed in `E2EE_IMPLEMENTATION_STATUS.md`; independently repeat |
| Tamper and replay vectors | Recorded as passed; independently repeat |
| Identity-change and device-revoke vectors | Recorded as passed; independently repeat |

Input hashes observed by the implementation environment:

| Input | SHA-256 |
| --- | --- |
| `Cargo.lock` | `b284c73b1d2f4486b70aa158cbdc0df67d3a98f437bae1441392f5d8de42caa9` |
| parity patch | `f58f4b8438e76f3e3e3c748685eda6d35f95e10f7c432399b5f79632ef3d6454` |

## 5. Independent Reproduction

The reviewer must use a clean environment and record commands, tool versions,
timestamps, and raw output locations.

1. Check out the frozen frontend and backend commits.
2. Rebuild signal-wasm according to `README.md` with the pinned lockfile and
   parity patch.
3. Confirm that rebuilt JavaScript and WASM hashes exactly match section 1.
4. Run the complete backend and frontend unit suites.
5. Run lint and the web application production build.
6. Run the real Chromium/WASM worker suite.
7. Repeat tamper, replay, identity-change, revoke, offline recovery, process
   restart, and Android-browser interoperability vectors.
8. Exercise pilot configuration failures, allowlist boundaries, recipient
   checks, send pause, and recovery paths against an isolated backend.
9. Inspect application, platform, Firebase, and telemetry logs for plaintext,
   ciphertext, tokens, and identifiers.
10. Verify that no error path falls back to legacy or plaintext.

Reviewer reproduction record:

| Item | Value |
| --- | --- |
| Environment | `REQUIRED` |
| Start timestamp | `REQUIRED` |
| End timestamp | `REQUIRED` |
| Frontend test result | `REQUIRED` |
| Backend test result | `REQUIRED` |
| Chromium/WASM result | `REQUIRED` |
| Android-browser result | `REQUIRED` |
| Rebuilt WASM SHA-256 | `REQUIRED` |
| Rebuilt JavaScript SHA-256 | `REQUIRED` |
| Raw evidence location | `REQUIRED` |

## 6. Findings

Every finding needs a stable ID, severity, affected commit/file, exploit or
failure scenario, remediation, and retest result. Do not delete resolved
findings; mark them resolved with evidence.

| ID | Severity | Status | Description | Remediation | Retest evidence |
| --- | --- | --- | --- | --- | --- |
| `REQUIRED` | `REQUIRED` | `REQUIRED` | `REQUIRED` | `REQUIRED` | `REQUIRED` |

Final open finding counts:

| Severity | Count |
| --- | --- |
| Critical | `REQUIRED` |
| High | `REQUIRED` |
| Medium | `REQUIRED` |
| Low | `REQUIRED` |

Approval requires zero open critical and zero open high findings.

## 7. Independent Reviewer Decision

Decision: `REQUIRED: APPROVED OR REJECTED`

Decision rationale: `REQUIRED`

Residual risks and pilot constraints: `REQUIRED`

The reviewer must explicitly confirm or reject all statements below:

- I reviewed the exact commits and artifacts in section 1.
- I performed the rebuild and tests independently from the implementer.
- I reviewed the authorization, enrollment, telemetry, and rollback delta.
- I found no path that silently falls back to plaintext or legacy messaging.
- I verified the final open finding counts.
- I authorize only the bounded pilot described by the runbook, not a general
  production rollout.

Reviewer name: `REQUIRED`

Organization: `REQUIRED`

Contact: `REQUIRED`

Review date: `REQUIRED`

Signature or verifiable approval reference: `REQUIRED`

## 8. Finalization

After the reviewer completes and freezes this document:

1. Compute its SHA-256.
2. Create `review-attestation.json` from the example.
3. Copy the exact commits, rebuilt artifact hashes, test outcomes, finding
   counts, reviewer identity, this path, and this report hash.
4. Run `npm run verify:e2ee:security-review`.
5. Set `review-subject.json.status` to `independent_review_approved` only after
   genuine approval.
6. Commit the frozen report and attestation without modifying the reviewed
   runtime commits.

Until those steps succeed, this document remains a draft and the production
pilot remains blocked.
