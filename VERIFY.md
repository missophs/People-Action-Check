# People Action Check — Verification Report
**Date:** 2026-07-08  
**Verifier:** Senior Verification Engineer  
**Inputs:** AUDIT.md, SPEC.md, current repository state (`pac-enterprise-slack-build`)  
**Method:** Independent evidence-based verification. No production code written or modified.

---

## Verification Summary

**VERDICT: IMPLEMENTATION NOT STARTED**

The SPEC.md was written and committed. No implementation work has been performed. Every quality gate related to SPEC.md deliverables fails due to absent implementation — not due to defects in existing code.

> "I cannot verify this implementation because the following quality gates still fail: all 17 audit findings remain unaddressed; all 8 SPEC.md new/modified files are absent; all 9 test suite failures persist; all 3 files marked for deletion still exist."

---

## Tests Executed

### Command
```bash
cd "/Users/Owner/Documents/Claude/05_RESOURCES/Projects/People Action Check" && npm test
```

### Result
```
Test Files  3 failed | 9 passed (12)
      Tests  9 failed | 280 passed (289)
   Start at  16:54:37
   Duration  279ms
```

### Failing Tests (all 9 — unchanged from AUDIT.md)

| Test File | Test Name | Failure |
|-----------|-----------|---------|
| `pac-blocks.test.js` | slash command buttons count | expected 5, got 3 |
| `pac-blocks.test.js` | slash command includes `pac_slash_open_intake` | not found in actions block |
| `pac-blocks.test.js` | slash command includes "Self-Check" text | not found |
| `pac-blocks.test.js` | scoreCard `fields` property | `scoreCard.fields` is undefined |
| `pac-blocks.test.js` | homeTabView includes "Start New Check" accessory | not found |
| `pac-blocks.test.js` | homeTabView includes `/pac` text | not found in output |
| `pac-blocks.test.js` | caseListBlocks includes case IDs | `c1`, `c2` not in rendered output |
| `interaction.test.js` | button label for doc upload | expected "Upload", got "Attach Files" |
| `pac-data-sync.test.js` | RIF NEXT_STEPS array length | CJS=1, ESM=3 (mismatch) |

---

## Commands Run

```bash
# 1. Full test suite
npm test

# 2. SPEC new file existence check (all 8 expected files)
ls netlify/functions/lib/export-token.js
ls netlify/functions/lib/resolve-context.js
ls scripts/build-cjs-bridge.js
ls netlify/functions/lib/pac-data.cjs
ls netlify/functions/lib/scoring.cjs
ls tests/slack/export-token.test.js
ls tests/slack/notify.test.js
ls tests/slack/submission.test.js

# 3. SPEC remove-file existence check (3 files to be deleted)
ls api/notify.js
ls vercel.json
ls src/slack/index.js

# 4. CRIT-01 evidence: activeToken mutable still present
grep -n "activeToken" netlify/functions/pac-slack.js

# 5. CRIT-01 evidence: PAC_ADMIN_TOKEN in URL still present
grep -n "token=" netlify/functions/pac-slack.js

# 6. MED-04 evidence: notify.js auth still absent
grep -n "PAC_ADMIN_TOKEN|Authorization|allowlist|NOTIFY_ALLOWED" netlify/functions/notify.js

# 7. MED-03 evidence: RIF NEXT_STEPS still diverged
node --input-type=module << 'EOF'
  const { NEXT_STEPS } = require('./netlify/functions/lib/pac-data.js');
  console.log(NEXT_STEPS['Reduction in Force'].good.length); // → 1
EOF

# 8. MED-01/02 evidence: local computeScore copies still present
grep -n "function computeScore|var ratio" netlify/functions/lib/pac-blocks.js
grep -n "var ratio|wNo/total" src/web/app-utils.js

# 9. MED-05 evidence: dead sort variable still present
grep -n "const sort" netlify/functions/lib/stores/airtable.js

# 10. Node syntax check — all Netlify function files
find netlify/functions -name "*.js" | xargs node --check
```

---

## Build Status

**`npm run build:cjs`**: FAIL — script does not exist.

```
$ node -e "require('./package.json').scripts['build:cjs']"
undefined
```

`scripts/build-cjs-bridge.js` does not exist. `package.json` has no `build:cjs` entry. `netlify/functions/lib/pac-data.cjs` does not exist. `netlify/functions/lib/scoring.cjs` does not exist.

**Node syntax check** (`node --check` on all Netlify function files): PASS — no syntax errors in existing files.

---

## Lint Status

No lint configuration found in the project (no `.eslintrc`, `eslint.config.js`, or `eslintIgnore` present). Lint gate: **NOT APPLICABLE** — no linter configured.

---

## Type Check Status

No TypeScript configuration present (`tsconfig.json` absent). Type check gate: **NOT APPLICABLE** — project is plain JavaScript.

---

## Startup Status

**`netlify dev` startup**: NOT RUN — verification does not require a live server when the implementation has not been applied. All startup-blocking issues would be the same as pre-audit baseline.

---

## Regression Results

280 tests continue to pass — identical to pre-audit baseline. No regressions introduced (because no implementation changes were made).

---

## Acceptance Criteria Status

Acceptance criteria are drawn directly from SPEC.md. Each is assessed against current repository evidence.

### Phase 1 — Credential & Auth

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `PAC_ADMIN_TOKEN` does not appear in any string passed to any Slack API call | **FAIL** | `pac-slack.js:1103`: `?token=${token}` in URL sent to Slack DM |
| Export links sent via Slack expire after 300 seconds | **FAIL** | `export-token.js` does not exist |
| `export-cases.js` returns 401 for requests with missing/invalid auth | **PARTIAL** | Existing `?token=` auth works; Bearer and `?sig=` paths do not exist |
| `notify.js` returns 401 without `Authorization: Bearer <PAC_ADMIN_TOKEN>` | **FAIL** | `notify.js` has no auth at all; any caller accepted |
| `notify.js` returns 403 for URLs not matching `NOTIFY_ALLOWED_DOMAINS` | **FAIL** | No allowlist exists |
| All export-token tests pass | **FAIL** | `tests/slack/export-token.test.js` does not exist |

### Phase 2 — Slack Handler

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All 5 view_submission handlers call `ack()` within 200ms (measured in test via spy) | **FAIL** | `tests/slack/submission.test.js` does not exist; handlers still sync-before-ack |
| `activeToken` does not appear in `pac-slack.js` source | **FAIL** | `grep` confirms `activeToken` at lines 125, 170, 218, 220, 238, 241, 245, 1156 |
| `resolveContext` is called exactly once per invocation | **FAIL** | `resolve-context.js` does not exist |
| All submission handler tests pass | **FAIL** | Test file does not exist |

### Phase 3 — Shared Logic

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `npm run build:cjs` exits 0 | **FAIL** | Script not present in `package.json` |
| `pac-data-sync.test.js` passes (RIF 3 steps per tier) | **FAIL** | Test fails; CJS still has 1 step per tier |
| `app-utils.js computeScore({ questions: [] })` returns `ratio: 0`, not NaN | **FAIL** | `src/web/app-utils.js:80`: `var ratio = wNo/total` — no zero guard present |
| `pac-blocks.js computeScore` and `app-utils.js computeScore` return identical shapes | **FAIL** | Both still have independent local implementations |

### Phase 4 — Hygiene

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `api/`, `vercel.json`, `src/slack/index.js` do not exist | **FAIL** | All three still exist |
| `airtable.js` contains no unused variable declarations | **FAIL** | `airtable.js:133`: `const sort = ...` still present, unreferenced |
| All 289 tests pass | **FAIL** | 9 tests still failing |

---

## Remaining Failures

### F-01 — CRIT-01: Admin Token Still in Slack URL

**Command:**
```bash
grep -n "token=" netlify/functions/pac-slack.js
```
**Actual output:**
```
1103:    const base   = `${WEB_APP_URL}/api/export-cases?token=${token}&format=${format}${filterParam}`;
1131:      const res = await fetch(`${WEB_APP_URL}/api/export-cases?token=${token}&format=${format}${filterParam}`, {
```
**Evidence:** `PAC_ADMIN_TOKEN` is read at line 1101 (`const token = process.env.PAC_ADMIN_TOKEN`) and placed directly into URLs at lines 1103 and 1131. These URLs are sent to Slack users as clickable links. Unmitigated.

---

### F-02 — HIGH-01: Ack-First Pattern Not Implemented

**Command:**
```bash
grep -n "activeToken\|ack(" netlify/functions/pac-slack.js | head -20
```
**Evidence:** `ack('')` is still returned after sequential `await` chains in all 5 view_submission handlers. No deferred-ack restructuring has occurred. No `tests/slack/submission.test.js` exists to validate timing.

---

### F-03 — HIGH-02: `activeToken` Module Mutable Still Present

**Command:**
```bash
grep -n "activeToken" netlify/functions/pac-slack.js
```
**Actual output:**
```
125:  const token = activeToken || process.env.PAC_SLACK_BOT_TOKEN;
170:  const token = activeToken || process.env.PAC_SLACK_BOT_TOKEN;
218:// activeToken is set per-request so slackApi uses the right bot token.
220:let activeToken = null;
238:  if (!hrSecret && !consultSecret) { console.warn('No signing secret set'); activeToken = process.env.PAC_SLACK_BOT_TOKEN; return true; }
241:    activeToken = process.env.PAC_SLACK_BOT_TOKEN;
245:    activeToken = process.env.PAC_CONSULTING_BOT_TOKEN || process.env.PAC_SLACK_BOT_TOKEN;
1156:  activeToken = null;
```
**Evidence:** Module-level `let activeToken = null` at line 220. Reset at line 1156 per invocation with race window. `resolve-context.js` not created.

---

### F-04 — MED-04: `notify.js` Has No Authentication

**Command:**
```bash
cat netlify/functions/notify.js
```
**Actual output:**
```js
exports.handler = async function (event) {
  // ... no auth check of any kind
  const r = await fetch(webhookUrl, { method: 'POST', ... });
  return { statusCode: 200, ... };
};
```
**Evidence:** 35 lines, zero authentication. `webhookUrl` from body proxied to any host. No `PAC_ADMIN_TOKEN` check. No `NOTIFY_ALLOWED_DOMAINS` allowlist.

---

### F-05 — MED-03: RIF NEXT_STEPS Still Diverged (1 vs 3)

**Command:**
```bash
node --input-type=module -e "
import { createRequire } from 'module';
const req = createRequire(import.meta.url);
const { NEXT_STEPS } = req('./netlify/functions/lib/pac-data.js');
const rif = NEXT_STEPS['Reduction in Force'];
console.log('good:', rif.good.length, 'warn:', rif.warn.length, 'risk:', rif.risk.length);
"
```
**Actual output:**
```
good: 1  warn: 1  risk: 1
```
**Evidence:** CJS `pac-data.js` still has 1 NEXT_STEPS item per tier for RIF. ESM `src/core/scenarios.js` has 3. `pac-data-sync.test.js` confirms mismatch with assertion failure.

---

### F-06 — MED-01: Divide-by-Zero Guard Absent

**Command:**
```bash
grep -n "var ratio\|wNo/total" src/web/app-utils.js
```
**Actual output:**
```
80:  var ratio = wNo/total;
```
**Evidence:** No zero-weight guard. `total === 0` produces `NaN`. Canonical `src/core/scoring.js` guard not applied.

---

### F-07 — MED-02: Three Independent `computeScore` Implementations Remain

**Command:**
```bash
grep -rn "function computeScore" src/ netlify/
```
**Actual output:**
```
src/core/scoring.js:9:function computeScore(questions, answers) {
src/web/app-utils.js:71:function computeScore(qs, answers) {
netlify/functions/lib/pac-blocks.js:45:function computeScore(questions, answers) {
```
**Evidence:** Three independent implementations. `scoring.cjs` generated bridge file does not exist. `pac-blocks.js` has not been updated to `require('./scoring.cjs')`.

---

### F-08 — MED-05: Dead Sort Variable Still Present

**Command:**
```bash
grep -n "const sort" netlify/functions/lib/stores/airtable.js
```
**Actual output:**
```
133:  const sort = encodeURIComponent(JSON.stringify([{ field: 'Created At', direction: 'desc' }]));
```
**Evidence:** Variable declared, never referenced in subsequent URL construction.

---

### F-09 — AR-1: Dead Files Not Removed

**Command:**
```bash
ls api/notify.js vercel.json src/slack/index.js
```
**Actual output:**
```
api/notify.js    vercel.json    src/slack/index.js
```
**Evidence:** All three files marked for deletion in SPEC.md Section "Files To Remove" still exist in the repository.

---

### F-10 — Test Suite: 9 Failures Persist

**Command:**
```bash
npm test 2>&1 | grep "FAIL\|Tests "
```
**Actual output:**
```
 FAIL  tests/slack/pac-blocks.test.js
 FAIL  tests/slack/interaction.test.js
 FAIL  tests/slack/pac-data-sync.test.js
      Tests  9 failed | 280 passed (289)
```
**Evidence:** All 9 failures identified in AUDIT.md remain. SPEC.md Phase 4 fix has not been applied.

---

### F-11 — New Test Files Not Created

**Evidence:** None of the 3 new test files specified in SPEC.md exist:
- `tests/slack/export-token.test.js` — MISSING
- `tests/slack/notify.test.js` — MISSING
- `tests/slack/submission.test.js` — MISSING

---

### F-12 — Build Script Not Created

**Evidence:** `scripts/build-cjs-bridge.js` does not exist. `package.json` has no `build:cjs` script. Generated files `pac-data.cjs` and `scoring.cjs` do not exist. The ESM/CJS bridge mechanism specified in SPEC.md Phase 3 is entirely absent.

---

## What Is Passing (Baseline Preserved)

- 280 existing tests continue to pass — no regressions from SPEC/AUDIT document commits
- `node --check` passes on all existing Netlify function files (no syntax errors)
- `verifySignature` remains unmodified (security constraint upheld)
- Employee identity not present in triage channel surfaces (security constraint upheld)
- Bot tokens still read from env vars only (security constraint upheld)

---

## Summary Table

| Gate | Status |
|------|--------|
| Full test suite (289 tests) | **FAIL** — 9 failures |
| Lint | N/A — no linter configured |
| Type check | N/A — no TypeScript |
| Build (`build:cjs`) | **FAIL** — script absent |
| Startup | Not tested (baseline unchanged) |
| CRIT-01 remediation | **FAIL** — token still in URL |
| HIGH-01 remediation | **FAIL** — sync-before-ack unchanged |
| HIGH-02 remediation | **FAIL** — `activeToken` mutable unchanged |
| MED-01 remediation | **FAIL** — zero guard absent |
| MED-02 remediation | **FAIL** — three implementations remain |
| MED-03 remediation | **FAIL** — RIF NEXT_STEPS still 1 vs 3 |
| MED-04 remediation | **FAIL** — notify.js still unauthenticated |
| MED-05 remediation | **FAIL** — dead sort variable remains |
| Phase 1 new files | **FAIL** — export-token.js, resolve-context.js absent |
| Phase 3 new files | **FAIL** — build script, generated .cjs files absent |
| Phase 4 new test files | **FAIL** — 3 new test files absent |
| Phase 4 file deletions | **FAIL** — api/notify.js, vercel.json, src/slack/index.js still present |
| All SPEC acceptance criteria | **FAIL** — 0 of 17 criteria met |

---

*Verification complete. No production code was written or modified during this verification.*
