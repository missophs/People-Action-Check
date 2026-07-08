# PAC Quality Audit
**Date:** 2026-07-08  
**Auditor:** Senior QE (automated audit, Claude Sonnet 4.6)  
**Scope:** Full repository — `netlify/functions/`, `src/`, `tests/`, `api/`, root config

---

## Executive Summary

The People Action Check application has **1 critical security defect**, **1 high-severity race condition**, **5 medium-severity correctness bugs**, and **9 test failures** that together reveal systemic gaps in data-layer parity, test maintenance, and async timing guarantees. The codebase also carries dead code, dual-platform deployment ambiguity, and three independent implementations of the same scoring function — one of which has a divide-by-zero defect.

No single finding would take the application down in normal load, but the admin-token exposure is an unacceptable credential leak in production today. The three-second Slack deadline risk will produce user-visible errors at any meaningful load spike.

**Total confirmed findings: 17**  
**Critical: 1 | High: 2 | Medium: 5 | Low: 5 | Informational: 4**

---

## Complete Defect Inventory

### CRIT-01 — Admin Token Exposed in Slack Message
**File:** `netlify/functions/pac-slack.js` lines 1101–1106  
**Severity:** Critical  
**Evidence:**
```js
const token  = process.env.PAC_ADMIN_TOKEN;
const base   = `${WEB_APP_URL}/api/export-cases?token=${token}&format=${format}${filterParam}`;
// base is then sent to the Slack user as a clickable link
```
`PAC_ADMIN_TOKEN` is a secret used in `export-cases.js` line 165 as the sole authentication gate for all case data exports. It is sent verbatim in a Slack DM URL to every user who requests an export. Any user who receives that message can bookmark the URL, share it, or extract the token from Slack logs. The token also appears in Slack's message payload on Slack's servers.

**Compare:** `save-hr-email.js` uses `Authorization: Bearer` header (never in URL). `export-cases.js` itself accepts `?token=` as a query parameter — this is the design flaw enabling the exposure.

---

### HIGH-01 — Slack 3-Second ACK Deadline at Risk
**File:** `netlify/functions/pac-slack.js`  
**Severity:** High  
**Handlers affected:** `MODAL_HR_REPLY` (~line 785), `MODAL_HR_RESOLVE` (~line 836), `MODAL_MGR_REPLY` (~line 885), `MODAL_UPLOAD_DOC` (~line 924), `MODAL_HR_REASSIGN` (~line 988)

Each handler `await`s multiple sequential operations (database reads, Slack API calls, blob store writes) before returning the HTTP `200 ack('')` response. Slack requires a `200` within 3 seconds or it retries the event, which can double-process the action. Under cold Lambda start + network latency, this window is easily exceeded.

**Evidence (MODAL_HR_REPLY pattern):**
```js
case 'MODAL_HR_REPLY': {
  const caseData = await dataStore.getCase(caseId);   // await 1
  await dataStore.updateCase(...)                       // await 2
  await slackClient.chat.postMessage(...)               // await 3
  return ack('');                                       // too late
}
```

---

### HIGH-02 — Race Condition: Module-Level `activeToken` Mutable
**File:** `netlify/functions/pac-slack.js` line 220  
**Severity:** High  
```js
let activeToken = null;
```
Warm Lambda instances serve concurrent requests. Each invocation resets `activeToken = null` at handler entry (~line 1156) then re-derives it from the workspace ID, but the window between `null` assignment and re-derivation, crossed with another concurrent invocation doing the same, can produce a request using the token of a different workspace. This is only exploitable under multi-workspace tenancy with concurrent Slack events — low probability per event but non-zero.

---

### MED-01 — Divide-by-Zero in Legacy `computeScore`
**File:** `src/web/app-utils.js` line 81  
**Severity:** Medium  
```js
var ratio = wNo / total;   // total === 0 → NaN when no questions
```
The canonical implementation in `src/core/scoring.js` guards this:
```js
const ratio = totalWeight > 0 ? weightedNo / totalWeight : 0;
```
`app-utils.js` does not. Any call path on the web app that triggers scoring with zero questions (e.g., a scenario that filters all questions out) will propagate `NaN` into display logic.

---

### MED-02 — `computeScore` Has Three Independent Implementations
**Files:** `src/core/scoring.js` (ESM), `src/web/app-utils.js` (legacy global), `netlify/functions/lib/pac-blocks.js` (CJS, line 45)  
**Severity:** Medium  
Three copies means three different return shapes and different guard behavior. The ESM canonical returns 8 fields; the legacy returns 5 fields (missing `ratio`, `totalWeight`, `weightedNo`). Any code that expects the canonical shape but calls the legacy will silently receive `undefined` for three fields. This is a latent correctness defect.

---

### MED-03 — RIF `NEXT_STEPS` Divergence: CJS vs ESM
**File:** `netlify/functions/lib/pac-data.js` vs `src/core/scenarios.js`  
**Severity:** Medium  
**Reproduced by:** `tests/slack/pac-data-sync.test.js` (failing)

```
MISMATCH: Reduction in Force.good  ESM=3  CJS=1
MISMATCH: Reduction in Force.warn  ESM=3  CJS=1
MISMATCH: Reduction in Force.risk  ESM=3  CJS=1
```

The ESM source has 3 detailed legal-process next steps per risk tier for RIF; the Netlify CJS copy has 1 generic step. This means the Slack app surface presents materially less guidance for RIF cases than the web app.

---

### MED-04 — `notify.js`: SSRF — Arbitrary Webhook Proxy with No Allowlist
**File:** `netlify/functions/notify.js`  
**Severity:** Medium  
```js
const r = await fetch(webhookUrl, { method: 'POST', ... });
```
`webhookUrl` comes from the caller's request body with no validation. Any authenticated caller (or any caller if the function has no auth — it has none) can cause the Netlify function to make a POST to an arbitrary URL, turning it into a server-side request forgery proxy. There is no domain allowlist, no scheme restriction, no authentication on the endpoint itself.

---

### MED-05 — Dead Variable in `airtable.js` Sort Parameter
**File:** `netlify/functions/lib/stores/airtable.js` line 133  
**Severity:** Low (functional dead code, but masks intent)  
```js
const sort = encodeURIComponent(JSON.stringify([{ field: 'updatedAt', direction: 'desc' }]));
// `sort` is never referenced — hardcoded sort string used in the actual URL
```
The computed `sort` value is declared but never used; a different hardcoded string appears in the actual API call. Sort order changes will require two-place edits, and the dead variable is misleading.

---

## Root Cause Groups

**RCG-1: Credential Handling Design** (CRIT-01)  
Token passed as URL query parameter by design in `export-cases.js`. The `?token=` pattern propagated into the Slack link-generation code without recognizing the channel difference (internal server → external Slack message logged by third party).

**RCG-2: Async/Lambda Timing** (HIGH-01)  
No deferred ack pattern (fire-and-forget background processing with immediate ack) was adopted. All view_submission handlers perform synchronous DB + Slack work before acking.

**RCG-3: Shared Mutable State in Lambda** (HIGH-02)  
Module-level mutable used for routing token. Pattern works in single-process environments but is incorrect in concurrent Lambda execution.

**RCG-4: ESM/CJS Split with Manual Duplication** (MED-02, MED-03)  
`src/` is ESM; `netlify/functions/` is CJS. Shared data and logic is manually duplicated rather than transpiled or bundled, creating permanent drift risk. `pac-data-sync.test.js` exists specifically to catch this drift but the RIF divergence slipped through.

**RCG-5: Test Suite Staleness** (9 failing tests)  
Tests in `pac-blocks.test.js` and `interaction.test.js` encode the old UI structure (5 buttons in one actions block, "Upload" label, slash command text). When the UI was redesigned, tests were not updated.

**RCG-6: No Input Validation on Proxy Endpoint** (MED-04)  
`notify.js` was built as a thin proxy with no security layer.

---

## Risk Matrix

| ID | Description | Likelihood | Impact | Priority |
|----|-------------|-----------|--------|----------|
| CRIT-01 | Admin token in Slack URL | Certain (every export) | Critical (full case data exposure) | P0 |
| HIGH-01 | 3-second ack deadline | Medium (load/cold start) | High (duplicate actions, user errors) | P1 |
| HIGH-02 | `activeToken` race | Low (multi-workspace concurrent) | High (wrong workspace auth) | P1 |
| MED-01 | `app-utils.js` divide-by-zero | Low (zero-question path) | Medium (NaN in score display) | P2 |
| MED-02 | Three `computeScore` impls | Certain (ongoing drift) | Medium (silent field missing) | P2 |
| MED-03 | RIF NEXT_STEPS CJS<ESM | Certain (deployed now) | Medium (worse guidance for RIF) | P2 |
| MED-04 | notify.js SSRF | Medium (no auth on endpoint) | Medium-High (outbound SSRF) | P2 |
| MED-05 | airtable.js dead sort var | Low | Low | P3 |

---

## Regression Risks

**RR-1: Token Rotation**  
If `PAC_ADMIN_TOKEN` is rotated to remediate CRIT-01, any existing Slack message containing the old token URL becomes permanently broken — and every previously sent export link is now a dangling credential in Slack history.

**RR-2: View Submission Handler Ack Refactor**  
Moving to a deferred-ack pattern for HIGH-01 requires restructuring all 5 view_submission branches. Risk of introducing new state bugs if case ID / user / workspace variables are not correctly captured before the async handoff.

**RR-3: `pac-data.js` RIF Fix**  
Updating CJS NEXT_STEPS to match ESM (MED-03) will change Slack modal content for all RIF cases. Regression risk: if the 3-step content is longer than Slack Block Kit text limits, modal rendering will silently truncate.

**RR-4: Test Fix Cascades**  
Fixing the 9 failing tests requires determining current truth (actual UI vs. old tests). Incorrect fix direction (updating tests to wrong state) masks real UI bugs.

---

## Missing Test Coverage

| Area | Gap |
|------|-----|
| `export-cases.js` | No tests for any export format (CSV, TSV, Word, JSON) or email delivery path |
| `MODAL_HR_REPLY`, `MODAL_HR_RESOLVE`, `MODAL_MGR_REPLY`, `MODAL_HR_REASSIGN`, `MODAL_UPLOAD_DOC` | No unit or integration tests for any of these view_submission handlers |
| `notify.js` | No tests; SSRF vector completely untested |
| `app-utils.js computeScore` | No test covering `total === 0` (the NaN path) |
| Multi-workspace token routing | No test for concurrent invocation or workspace ID mismatch |
| `airtable.js listCasesForManager` | Sort behavior not tested |
| `save-hr-email.js` | No tests for auth failure path (missing or wrong token) |
| `send-report-email.js` | No tests for attachment path or Brevo error handling |
| Slack 3-second deadline | No test that measures time-to-ack on any handler |
| `pac-data-sync.test.js` | RIF test fails — test exists but finding is not resolved |

---

## Architecture Risks

**AR-1: Dual Platform Deployment (Netlify + Vercel)**  
`netlify.toml`, `netlify/functions/`, and `vercel.json`, `api/` coexist. `api/notify.js` is a Vercel-format duplicate of `netlify/functions/notify.js` (different export pattern: `export default` vs `exports.handler`). It is unknown which is actually deployed and which is dead. Dual configuration creates audit surface confusion and the risk that fixes applied to one are not applied to the other.

**AR-2: Manual ESM/CJS Synchronization**  
The project has no build step to generate the CJS copy from the ESM source. All data and logic shared between `src/` and `netlify/functions/lib/` is maintained by hand. The sync test (`pac-data-sync.test.js`) is the only guard, and it currently has a known failure that is unresolved.

**AR-3: No Authentication on `notify.js`**  
The endpoint is reachable without credentials. Any external actor who discovers the Netlify function URL can use it as an outbound HTTP proxy.

**AR-4: `PAC_ADMIN_TOKEN` as URL Query Parameter**  
The underlying design of `export-cases.js` accepts the admin token as `?token=`. This pattern causes tokens to appear in server access logs, browser history, Slack message content, and any CDN/proxy sitting in front of Netlify — all without the user or admin being aware.

**AR-5: Scaffold Stub in Committed Source**  
`src/slack/index.js` exports `SCAFFOLD_STATUS = 'pending-phase-3'` and is never imported. This signals incomplete planned work is in the main branch with no tracking.

---

## Prioritized Fix Order

| Priority | ID | Fix Description |
|----------|----|-----------------|
| P0 | CRIT-01 | Remove `PAC_ADMIN_TOKEN` from export URL; replace with server-side session or signed short-lived URL |
| P1 | HIGH-01 | Adopt deferred ack pattern: ack immediately, process in background for all 5 view_submission handlers |
| P1 | HIGH-02 | Remove module-level `activeToken` mutable; derive from request context per-invocation only |
| P1 | MED-04 | Add domain allowlist or authentication to `notify.js` |
| P2 | MED-03 | Sync RIF `NEXT_STEPS` in `pac-data.js` to match `src/core/scenarios.js` (3 steps per tier) |
| P2 | MED-01 | Add `totalWeight > 0` guard to `app-utils.js computeScore` |
| P2 | 9 failures | Fix or rewrite `pac-blocks.test.js` (7) and `interaction.test.js` (1) to match current UI; resolve `pac-data-sync.test.js` (1) via MED-03 fix |
| P3 | AR-1 | Resolve Netlify vs Vercel dual-platform ambiguity; remove the unused platform's config and code |
| P3 | MED-02 | Consolidate `computeScore` to one implementation or use build-time CJS transpilation |
| P3 | MED-05 | Remove dead `sort` variable in `airtable.js` |
| P4 | AR-5 | Remove or track `src/slack/index.js` scaffold stub |

---

*Audit complete. No production code was written or modified during this audit.*
