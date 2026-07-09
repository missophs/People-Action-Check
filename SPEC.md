# PAC Refactor Specification
**Date:** 2026-07-08  
**Author:** Senior Software Architect  
**Input:** AUDIT.md (2026-07-08)  
**Status:** Draft — awaiting review

---

## Executive Summary

People Action Check (PAC) is a Netlify-hosted Slack app and web frontend for structured HR case management. The audit identified 17 confirmed defects across security, reliability, correctness, and maintainability. This specification translates those findings into a phased refactor that eliminates the credential-exposure risk (CRIT-01), hardens async reliability (HIGH-01, HIGH-02), closes the SSRF vector (MED-04), and unifies the split ESM/CJS codebase (MED-02, MED-03) — all without altering user-visible behavior.

The refactor is organized by root cause, not by file. Each phase solves an entire subsystem.

---

## Goals

1. Eliminate `PAC_ADMIN_TOKEN` exposure in Slack messages (CRIT-01)
2. Guarantee Slack 3-second ack deadline on all view_submission handlers (HIGH-01)
3. Remove module-level mutable state from Lambda request handling (HIGH-02)
4. Close `notify.js` SSRF vector with domain allowlist + bearer auth (MED-04)
5. Unify `computeScore` to a single canonical implementation (MED-01, MED-02)
6. Synchronize ESM/CJS shared data via build-time generation, not hand-editing (MED-03)
7. Restore 9 failing tests to passing; add missing coverage for all patched areas
8. Remove dual-platform ambiguity (Netlify vs Vercel)
9. Remove dead code

---

## Non-Goals

- No new features
- No changes to Slack Block Kit UI structure or modal flows
- No migration of the data store (Airtable remains)
- No changes to user-visible behavior, copy, or workflow
- No changes to authentication flows (`verifySignature` is immutable per security policy)
- No upgrade to Slack Bolt framework in this refactor

---

## Current Architecture

```
People Action Check
├── src/                        ESM web frontend + shared core logic
│   ├── core/
│   │   ├── scoring.js          canonical computeScore (ESM)
│   │   └── scenarios.js        SCENARIO_QUESTIONS, SCENARIO_META, NEXT_STEPS (ESM)
│   ├── web/
│   │   └── app-utils.js        legacy computeScore duplicate (global var, no guard)
│   └── slack/
│       └── index.js            scaffold stub (never imported)
│
├── netlify/functions/          CJS Netlify Lambda functions
│   ├── pac-slack.js            monolith: slash cmd, block_actions, view_submission, events
│   ├── export-cases.js         case data export — auth via ?token= query param
│   ├── notify.js               outbound webhook proxy — no auth, no allowlist
│   ├── save-hr-email.js        HR email config write
│   └── lib/
│       ├── pac-blocks.js       Block Kit builders + third computeScore copy
│       ├── pac-data.js         CJS copy of scenarios.js — manually maintained
│       ├── data-store.js       Airtable data access
│       ├── blob-store.js       Netlify Blobs (HR config, policy docs)
│       ├── export-token.js     HMAC signed token (added Phase 1 prior work)
│       ├── governance.js       ACTION_IDS, CALLBACK_IDS, BLOCK_IDS, AUDIT_EVENTS
│       ├── email-notify.js     Brevo email delivery
│       └── stores/
│           └── airtable.js     Airtable REST client
│
├── api/                        Vercel-format duplicate functions (deployment unknown)
│   └── notify.js               export default format — duplicates netlify/functions/notify.js
│
├── tests/
│   └── slack/                  Vitest test suite
│
└── netlify.toml                Netlify config (build, redirects, function settings)
```

**Key characteristics:**
- `src/` is ESM (`"type": "module"`)
- `netlify/functions/` is CJS (`require()`)
- Shared logic is manually duplicated across the boundary — no build step generates CJS from ESM
- `pac-slack.js` is a single ~1,240-line file handling all Slack interactions
- `export-token.js` exists and is ready for use (sign/verify implemented and tested)

---

## Problems Identified

Derived directly from AUDIT.md. Grouped by root cause.

### RCG-1: Credential Handling Design (CRIT-01, AR-4)
`export-cases.js` accepts `PAC_ADMIN_TOKEN` as a `?token=` query parameter. `pac-slack.js` constructs export URLs with this token embedded and sends them to Slack users via DM. The token appears in Slack message history, Slack's servers, browser history, and server access logs on every export request.

### RCG-2: Async/Lambda Timing (HIGH-01)
Five `view_submission` handlers perform sequential DB reads, DB writes, and Slack API calls before returning `200 ack('')`. Slack requires HTTP 200 within 3 seconds. Under cold Lambda start, a 3-operation chain easily exceeds this limit, causing Slack to retry and double-process the action.

### RCG-3: Shared Mutable State in Lambda (HIGH-02)
`let activeToken = null` at module level is set by `verifySignature()` and read by the handler. Concurrent warm Lambda invocations share this module scope. The window between `null` reset and re-derivation allows cross-contamination of workspace tokens under concurrent requests.

### RCG-4: ESM/CJS Split with Manual Duplication (MED-01, MED-02, MED-03)
`computeScore` has three independent implementations with different return shapes and guards. `pac-data.js` (CJS) is a manually maintained copy of `scenarios.js` (ESM). The RIF `NEXT_STEPS` divergence (3 steps ESM vs 1 step CJS) is deployed today and produces materially worse guidance for RIF cases in the Slack app.

### RCG-5: No Input Validation on Proxy Endpoint (MED-04, AR-3)
`notify.js` accepts an arbitrary `webhookUrl` from the request body and proxies a POST to it with no authentication and no domain restriction. This is a live SSRF vector.

### RCG-6: Test Suite Staleness (9 failing tests)
Tests in `pac-blocks.test.js` and `interaction.test.js` encode the old UI structure. `pac-data-sync.test.js` has a known failure matching the RIF divergence in RCG-4.

### RCG-7: Dual Platform Ambiguity (AR-1)
`api/notify.js` (Vercel format) and `netlify/functions/notify.js` (CJS format) coexist. Which is actually deployed is unknown.

### RCG-8: Dead Code (MED-05, AR-5)
`airtable.js` has a dead `sort` variable (declared, never used). `src/slack/index.js` is a scaffold stub that is never imported.

---

## Root Cause Mapping

| Finding | Root Cause Group | Phase |
|---------|-----------------|-------|
| CRIT-01 | RCG-1 | Phase 1 |
| HIGH-01 | RCG-2 | Phase 2 |
| HIGH-02 | RCG-3 | Phase 2 |
| MED-04 | RCG-5 | Phase 3 |
| MED-01, MED-02, MED-03 | RCG-4 | Phase 4 |
| 9 test failures | RCG-6 | Phase 5 |
| AR-1, MED-05, AR-5 | RCG-7, RCG-8 | Phase 6 |

---

## Proposed Architecture

### Phase 1: Replace Token-in-URL with Signed Export Token

`export-token.js` already implements `sign(payload, ttlSeconds)` and `verify(token)` using HMAC-SHA256 keyed on `EXPORT_TOKEN_SECRET`. The change:

1. `pac-slack.js` calls `exportToken.sign({ userId, format, filter }, 900)` to produce a short-lived opaque token
2. Export URL uses `?exportToken=<signed>` instead of `?token=<admin_secret>`
3. `export-cases.js` calls `exportToken.verify()` instead of comparing raw `PAC_ADMIN_TOKEN`
4. `PAC_ADMIN_TOKEN` is never placed in any URL

The signed token encodes `{ userId, format, filter, exp }`, expires in 15 minutes (configurable), and is meaningless if leaked — it carries no reusable credential.

### Phase 2: Deferred Ack + Token-Per-Request

All five `view_submission` handlers adopt the fire-and-forget pattern:

```
receive event
  → synchronously capture: caseId, userId, payload fields, workspace token
  → return ack('') immediately (< 50ms, no I/O)
  → background IIFE: DB reads, DB writes, Slack API calls
```

`verifySignature()` is changed to return `{ valid: boolean, token: string | null }` instead of setting a module-level side effect. The module-level `let activeToken = null` is removed. The returned token is passed directly into `_tokenStore.run()`.

The `verifySignature` auth logic itself is not changed — only its return shape.

### Phase 3: Notify Security Layer

`notify.js` gains sequential guards:
1. Method check (OPTIONS → 200, non-POST → 405)
2. Bearer token auth against `PAC_ADMIN_TOKEN`; 401 if missing/wrong; 503 if env unset
3. JSON body parse; 400 if invalid
4. `webhookUrl` present + valid URL + `https:` scheme; 400/403 as appropriate
5. Hostname in `NOTIFY_ALLOWED_DOMAINS` (env var, comma-separated); 403 if not listed; 503 if env unset
6. Proxy POST; return result

### Phase 4: ESM/CJS Unification via Build-Time Generation

`scripts/build-cjs-bridge.js` (already exists, already wired into `netlify.toml` build command) generates `lib/pac-data.cjs` and `lib/scoring.cjs` from `src/core/` at deploy time.

- `pac-blocks.js` removes its inline `computeScore`; imports from `./scoring.cjs`
- `app-utils.js` removes its inline `computeScore`; imports from `../../src/core/scoring.js`
- `pac-data.cjs` becomes a generated artifact — no hand-edits
- RIF `NEXT_STEPS` fix: `src/core/scenarios.js` is the source of truth (ESM already has 3 steps); regeneration of `pac-data.cjs` propagates the fix automatically

---

## Folder Structure

No new top-level directories. Changes within existing structure:

```
netlify/functions/
├── pac-slack.js           (modified — Phase 1: signed token; Phase 2: deferred ack + token return)
├── export-cases.js        (modified — Phase 1: verify signed token)
├── notify.js              (modified — Phase 3: auth + allowlist)
└── lib/
    ├── export-token.js    (unchanged — already implemented)
    ├── pac-blocks.js      (modified — Phase 4: remove inline computeScore)
    ├── pac-data.cjs       (generated — Phase 4: do not hand-edit)
    └── scoring.cjs        (generated — Phase 4: do not hand-edit)

src/
├── core/
│   ├── scoring.js         (unchanged — canonical source)
│   └── scenarios.js       (verify RIF data correct — no edit expected)
└── web/
    └── app-utils.js       (modified — Phase 4: remove duplicate, import canonical)

scripts/
└── build-cjs-bridge.js    (verify it exports NEXT_STEPS — may need minor update)

api/
└── notify.js              (Phase 3: patch to match, or Phase 6: delete)

tests/slack/
├── export-token.test.js   (exists — 9 tests — Phase 1 coverage)
├── notify.test.js         (exists — 12 tests — Phase 3 coverage)
├── submission.test.js     (exists — 9 tests — Phase 2 coverage)
├── pac-blocks.test.js     (modified — Phase 5: fix 7 failing tests)
└── interaction.test.js    (modified — Phase 5: fix 1 failing test)
```

---

## Module Responsibilities

| Module | Owns | Does Not Own |
|--------|------|-------------|
| `src/core/scoring.js` | Single canonical `computeScore` | Formatting, fetching, Slack |
| `src/core/scenarios.js` | All scenario data, questions, next steps | Rendering, scoring |
| `scripts/build-cjs-bridge.js` | CJS generation from `src/core/` at build time | Runtime logic |
| `lib/export-token.js` | Sign + verify short-lived export tokens | Auth for other endpoints |
| `lib/pac-blocks.js` | Block Kit UI construction | Scoring logic (delegates to bridge) |
| `pac-slack.js` | Slack event routing, ack, background dispatch | Business logic (delegates to lib/) |
| `export-cases.js` | Export format rendering + signed token auth | Token generation |
| `notify.js` | Authenticated domain-restricted outbound webhook proxy | Token management |

---

## Dependency Boundaries

```
src/core/scoring.js          ← no dependencies on netlify/ or src/web/
src/core/scenarios.js        ← no dependencies on netlify/ or src/web/

src/web/app-utils.js         → src/core/scoring.js (import)

lib/scoring.cjs              ← generated from src/core/scoring.js
lib/pac-data.cjs             ← generated from src/core/scenarios.js

pac-slack.js                 → lib/export-token.js
                             → lib/pac-blocks.js
                             → lib/data-store.js
                             → lib/governance.js

export-cases.js              → lib/export-token.js

notify.js                    → no shared lib (self-contained)
```

**Rules:**
- `src/core/` has zero inbound dependencies from `netlify/`
- Generated CJS files in `lib/` are never hand-edited
- `pac-slack.js` delegates all business logic to `lib/`

---

## Data Flow

### Export Flow (Phase 1)

```
User requests export in Slack
  → pac-slack.js: exportToken.sign({ userId, format, filter }, 900)
  → builds URL: /api/export-cases?exportToken=<signed>&format=csv
  → sends DM with URL (token is opaque, expires in 15 min, scoped to user+format)

User visits export URL
  → export-cases.js: exportToken.verify(req.query.exportToken)
    → throws if expired, tampered, or missing → 401
  → streams case data in requested format → 200
```

### view_submission Deferred Ack Flow (Phase 2)

```
Slack POST view_submission
  → verifySignature(event) → { valid: true, token: 'xoxb-...' }
  → _tokenStore.run(token, async () => {
      // Synchronous captures — no await
      const caseId   = payload.view.private_metadata.caseId
      const userId   = payload.user.id
      const wsToken  = _tokenStore.getStore()

      // Fire background IIFE — does NOT block ack
      ;(async () => {
        const caseData = await dataStore.findCaseById(caseId)
        await dataStore.saveCase(...)
        await slackApi('chat.postMessage', ..., wsToken)
      })().catch(err => console.error('[pac-slack] background error', callbackId, err))

      return ack('')   // returns < 50ms, before any I/O
    })
```

---

## Public Interfaces

### `lib/export-token.js` (unchanged)

```js
sign(payload: object, ttlSeconds: number): string
verify(token: string): object  // throws on invalid/expired
```

### `export-cases.js` (modified auth)

```
GET /api/export-cases?exportToken=<signed>&format=csv|tsv|json|word
→ 200 with file payload
→ 401 if token missing, expired, or tampered
→ 400 if format invalid
```

### `notify.js` (Phase 3)

```
POST /api/notify
Authorization: Bearer <PAC_ADMIN_TOKEN>
Body: { webhookUrl: string, payload: object }
→ 200 proxied response
→ 401 missing/wrong auth
→ 400 invalid body or URL
→ 403 webhookUrl domain not in allowlist, or not https
→ 405 non-POST method
→ 503 env vars not configured
```

---

## Files To Create

None. All required files already exist or are generated by `build-cjs-bridge.js`.

---

## Files To Modify

| File | Change | Phase |
|------|--------|-------|
| `netlify/functions/pac-slack.js` | Replace raw token in export URL with signed token | 1 |
| `netlify/functions/export-cases.js` | Verify signed token instead of raw `PAC_ADMIN_TOKEN` | 1 |
| `netlify/functions/pac-slack.js` | Deferred ack on 5 handlers; `verifySignature` returns token | 2 |
| `netlify/functions/notify.js` | Add auth + domain allowlist + input validation | 3 |
| `api/notify.js` | Same as above, or delete (Phase 6) | 3/6 |
| `netlify/functions/lib/pac-blocks.js` | Remove inline `computeScore`; import from `scoring.cjs` | 4 |
| `src/web/app-utils.js` | Remove duplicate `computeScore`; import from canonical | 4 |
| `scripts/build-cjs-bridge.js` | Verify `NEXT_STEPS` is exported from scenarios bridge | 4 |
| `tests/slack/pac-blocks.test.js` | Fix 7 failing tests to match current UI | 5 |
| `tests/slack/interaction.test.js` | Fix 1 failing test | 5 |
| `netlify/functions/lib/stores/airtable.js` | Remove dead `sort` variable | 6 |

---

## Files To Remove

| File | Reason | Phase |
|------|--------|-------|
| `src/slack/index.js` | Scaffold stub, never imported | 6 |
| `api/notify.js` | Delete if Vercel confirmed unused; patch otherwise | 6 |
| `vercel.json` | Delete if Vercel confirmed unused | 6 |

---

## Migration Strategy

### Phase 1 — Token Rotation Required

**Sequence matters:**
1. Deploy Phase 1 code changes first
2. Rotate `PAC_ADMIN_TOKEN` after confirming Phase 1 works end-to-end
3. Ensure `EXPORT_TOKEN_SECRET` is set in Netlify env vars

Rotating `PAC_ADMIN_TOKEN` invalidates all existing Slack export DMs — acceptable because those DMs contained a live credential. Do not rotate before Phase 1 deploys or the new export flow won't work.

### Phase 2 — No Env Changes

Deploy and smoke-test all 5 modal flows. Monitor logs for `[pac-slack] background error` lines after deploy.

### Phase 3 — Env Var Required Before Deploy

Add `NOTIFY_ALLOWED_DOMAINS=hooks.slack.com` (and any other current targets) to Netlify env vars **before** deploying Phase 3. After deploy, unauthenticated callers will receive 401.

### Phase 4 — Verify Build Output Locally First

Run `npm run build:cjs` locally. Open the generated `lib/pac-data.cjs` and confirm RIF `NEXT_STEPS` has 3 entries per tier. Run `npm test` locally — `pac-data-sync.test.js` must pass before pushing.

### Phases 5–6 — Test and Cleanup Only

No env var or data store changes. Each phase is independently revertible.

---

## Risk Analysis

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Existing Slack export links break on token rotation | Certain | Announce to admins; links were credential leaks regardless |
| Deferred IIFE silently swallows errors | Medium | `.catch(err => console.error(...))` on every IIFE; monitor log error rate |
| Background IIFE captures stale closure variable | Medium | Capture all needed values as `const` before the IIFE; validated by `submission.test.js` |
| RIF 3-step content hits Block Kit text limits | Low | Block Kit `plain_text` limit is 3000 chars; 3 short legal steps are well under |
| `pac-data.cjs` accidentally hand-edited post-Phase-4 | Low | Add `// GENERATED — do not edit` header; CI `npm run build:cjs` overwrites it |
| `api/notify.js` is the live endpoint, not `netlify/functions/notify.js` | Unknown | Audit Netlify function invocation logs vs Vercel project before Phase 3 |
| `verifySignature` return shape change breaks other callers | Low | Only two call sites in `pac-slack.js`; both updated in same commit |

---

## Test Strategy

### Coverage by Phase

| Phase | New/Fixed Tests | Area |
|-------|----------------|------|
| 1 | `export-token.test.js` (9, existing) | sign/verify/tamper/expire |
| 1 | New: `export-cases` auth tests | missing/invalid/expired exportToken → 401 |
| 2 | `submission.test.js` (9, existing) | ack < I/O timing on all 5 handlers |
| 3 | `notify.test.js` (12, existing) | auth, allowlist, SSRF, input validation |
| 4 | New: `scoring.test.js` | `totalWeight === 0` path returns 0 not NaN |
| 4 | Fix: `pac-data-sync.test.js` | RIF NEXT_STEPS ESM ↔ CJS match |
| 5 | Fix: `pac-blocks.test.js` (7) | match current Block Kit structure |
| 5 | Fix: `interaction.test.js` (1) | match current interaction structure |

### Test Approach

- Tests for Phase 2 (deferred ack) must assert that ack returns **before** the mocked I/O resolves — `submission.test.js` already does this via a 5ms `setTimeout` in the data-store mock
- Tests for Phase 3 (`notify.js`) are self-contained: they stub `fetch` and validate status codes for each guard
- `pac-data-sync.test.js` is a contract test: it imports both ESM and CJS sources and asserts structural equality — no mocking needed

---

## Acceptance Criteria

### Phase 1
- [ ] No occurrence of `PAC_ADMIN_TOKEN` in any URL constructed in `pac-slack.js`
- [ ] Export URL contains `exportToken=` (signed, opaque) not `token=` (raw secret)
- [ ] `export-cases.js` returns 401 for missing/expired/tampered `exportToken`
- [ ] `export-cases.js` returns 200 with correct data for valid signed token
- [ ] Signed token expires ≤ 15 minutes after generation
- [ ] `PAC_ADMIN_TOKEN` continues to work for `save-hr-email.js` write auth

### Phase 2
- [ ] All 5 view_submission handlers return HTTP 200 before any `await` in the handler completes
- [ ] Background processing still completes: DB updated, Slack message posted, audit written
- [ ] `let activeToken` does not exist in `pac-slack.js`
- [ ] `verifySignature` returns `{ valid, token }` — no module-level side effect
- [ ] `submission.test.js` all 9 tests pass

### Phase 3
- [ ] `POST /api/notify` without auth → 401
- [ ] `POST /api/notify` with wrong token → 401
- [ ] `POST /api/notify` with domain not in allowlist → 403
- [ ] `POST /api/notify` with `http://` scheme → 403
- [ ] `POST /api/notify` with invalid URL → 400
- [ ] `POST /api/notify` with valid auth + allowed domain → 200
- [ ] `notify.test.js` all 12 tests pass

### Phase 4
- [ ] `scoring.js` `computeScore` with `totalWeight === 0` returns `{ ratio: 0, ... }` not NaN
- [ ] `pac-blocks.js` has no inline `computeScore` — delegates to `scoring.cjs`
- [ ] `app-utils.js` has no inline `computeScore` — imports from `src/core/scoring.js`
- [ ] RIF scenario in Slack displays 3 next steps per risk tier
- [ ] `pac-data-sync.test.js` passes
- [ ] `npm run build:cjs` exits 0; generated files match ESM sources

### Phase 5
- [ ] `npm test` exits 0
- [ ] Zero skipped tests related to patched findings

### Phase 6
- [ ] `src/slack/index.js` deleted
- [ ] Dead `sort` variable removed from `airtable.js`
- [ ] `api/` directory either deleted (with `vercel.json`) or documented as active and patched
- [ ] `npm run lint` exits 0 with zero warnings

---

## Rollback Strategy

Each phase is a discrete git commit on `pac-enterprise-slack-build`. Rollback: `git revert <commit>` + Netlify redeploy.

**Phase 1 complication:** If `PAC_ADMIN_TOKEN` was rotated as part of Phase 1 remediation, rolling back Phase 1 code still leaves the old token invalid. Re-rotate to a new value and update Netlify env var. Do not restore the pre-rotation token value.

**Phase 4 complication:** After rollback, `pac-data.cjs` may be stale (generated from post-Phase-4 source but reverted build script). Run `npm run build:cjs` manually after Phase 4 rollback to restore pre-Phase-4 generated content.

---

## Open Questions

1. **Is `api/notify.js` (Vercel) the live endpoint?** Check Vercel project dashboard and Netlify function invocation logs. Determines whether Phase 3 patches one file or two, and whether Phase 6 deletes `api/`.

2. **`EXPORT_TOKEN_TTL`: 15 minutes or longer?** HR admins doing large multi-format exports may need more time between link generation and click. Propose 60 minutes as default, configurable via `EXPORT_TOKEN_TTL` env var.

3. **Background IIFE errors: log-only or DM the user?** Phase 2 proposal is log-only. If a Slack API call fails in the background, the user sees no feedback. A follow-up DM on background failure would improve UX but is out of scope for this refactor.

4. **`NOTIFY_ALLOWED_DOMAINS` initial value:** Enumerate all current webhook targets from `notify.js` usages before setting this env var. Is `hooks.slack.com` the only target?

5. **`app-utils.js computeScore` removal or re-export?** The safest path is a thin re-export shim that delegates to `src/core/scoring.js`, preserving all existing call-site paths in web context without requiring path changes across the web frontend.

---

## Implementation Phases

### Phase 1 — Credential Handling (CRIT-01)
**Root cause:** RCG-1  
**Priority:** P0  
**Files:** `pac-slack.js`, `export-cases.js`  
**Env vars:** Ensure `EXPORT_TOKEN_SECRET` set; rotate `PAC_ADMIN_TOKEN` after deploy  
**Tests:** `export-token.test.js` (existing); new `export-cases.js` auth tests  

**Changes:**

In `pac-slack.js`, locate export URL construction (~line 1101–1106):
```js
// Remove:
const token = process.env.PAC_ADMIN_TOKEN;
const base  = `${WEB_APP_URL}/api/export-cases?token=${token}&format=${format}${filterParam}`;

// Replace with:
const exportTok = exportToken.sign({ userId: payload.user.id, format, filter }, 900);
const base = `${WEB_APP_URL}/api/export-cases?exportToken=${exportTok}&format=${format}${filterParam}`;
```

In `export-cases.js`, replace admin token check:
```js
// Remove:
if (event.queryStringParameters?.token !== process.env.PAC_ADMIN_TOKEN) {
  return { statusCode: 401, ... };
}

// Replace with:
const exportToken = require('./lib/export-token');
try {
  exportToken.verify(event.queryStringParameters?.exportToken);
} catch {
  return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
}
```

---

### Phase 2 — Async Reliability (HIGH-01, HIGH-02)
**Root cause:** RCG-2, RCG-3  
**Priority:** P1  
**Files:** `pac-slack.js`  
**Env vars:** None  
**Tests:** `submission.test.js` (existing 9 tests)  

**Changes:**

1. Change `verifySignature` to return `{ valid, token }` instead of setting `activeToken`:
```js
function verifySignature(event) {
  // ... existing HMAC logic unchanged ...
  if (tryVerify(hrSecret, ts, sig, rawBody)) return { valid: true, token: process.env.PAC_SLACK_BOT_TOKEN };
  if (tryVerify(consultSecret, ts, sig, rawBody)) return { valid: true, token: process.env.PAC_CONSULTING_BOT_TOKEN || process.env.PAC_SLACK_BOT_TOKEN };
  return { valid: false, token: null };
}
```

2. Remove `let activeToken = null` from module scope.

3. Update handler entry:
```js
const { valid, token } = verifySignature(event);
if (!valid) return { statusCode: 401, ... };
return _tokenStore.run(token, async () => { ... });
```

4. For each of the 5 view_submission handlers, wrap async work in a deferred IIFE:
```js
case 'MODAL_HR_REPLY': {
  const caseId  = JSON.parse(payload.view.private_metadata).caseId;
  const userId  = payload.user.id;
  const wsToken = _tokenStore.getStore();

  ;(async () => {
    const caseData = await dataStore.findCaseById(caseId);
    await dataStore.saveCase(...);
    await slackApi('chat.postMessage', { ... }, wsToken);
  })().catch(err => console.error('[pac-slack] MODAL_HR_REPLY background error', err));

  return ack('');
}
```

---

### Phase 3 — Notify Security (MED-04)
**Root cause:** RCG-5  
**Priority:** P1  
**Files:** `netlify/functions/notify.js`, `api/notify.js` (or delete)  
**Env vars:** Add `NOTIFY_ALLOWED_DOMAINS=hooks.slack.com` to Netlify  
**Tests:** `notify.test.js` (existing 12 tests)  

**Changes (in order, inside `notify.js` handler):**
1. `OPTIONS` → 200; non-POST → 405
2. Read `PAC_ADMIN_TOKEN` from env; 503 if missing
3. Check `Authorization: Bearer <token>`; 401 if wrong or absent
4. Parse body as JSON; 400 if invalid
5. Require `webhookUrl` field; 400 if missing
6. Parse `webhookUrl` as URL; 400 if parse fails; 403 if scheme not `https:`
7. Read `NOTIFY_ALLOWED_DOMAINS` from env; 503 if missing
8. Check `webhookUrl` hostname is in comma-split allowlist (exact match); 403 if not
9. `fetch(webhookUrl, { method: 'POST', body: JSON.stringify(payload) })`; return result

---

### Phase 4 — ESM/CJS Unification (MED-01, MED-02, MED-03)
**Root cause:** RCG-4  
**Priority:** P2  
**Files:** `app-utils.js`, `pac-blocks.js`, `build-cjs-bridge.js` (verify)  
**Env vars:** None  
**Tests:** `pac-data-sync.test.js` (fix); new `scoring.test.js`  

**Changes:**
1. Confirm `src/core/scenarios.js` RIF `NEXT_STEPS` has 3 entries per tier (ESM canonical — no edit expected).
2. Confirm `build-cjs-bridge.js` exports `NEXT_STEPS` from the scenarios bridge (add if missing).
3. In `pac-blocks.js`, remove inline `computeScore`; add `const { computeScore } = require('./scoring.cjs')`.
4. In `app-utils.js`, remove inline `computeScore`; add `import { computeScore } from '../../src/core/scoring.js'`; export it for existing callers.
5. Run `npm run build:cjs` locally; verify `pac-data.cjs` has 3 RIF steps; verify `scoring.cjs` exists.
6. Run `npm test` locally; `pac-data-sync.test.js` must pass before pushing.

---

### Phase 5 — Test Suite Restoration
**Root cause:** RCG-6  
**Priority:** P2  
**Files:** `pac-blocks.test.js`, `interaction.test.js`  

**Changes:**
1. For each of the 7 failing `pac-blocks.test.js` tests: read the current Block Kit output of the function under test; update the assertion to match current structure.
2. Fix 1 failing `interaction.test.js` test similarly.
3. `pac-data-sync.test.js` passes automatically from Phase 4.
4. `npm test` exits 0.

---

### Phase 6 — Dead Code and Platform Cleanup
**Root cause:** RCG-7, RCG-8  
**Priority:** P3  

**Changes:**
1. Determine whether Vercel project is live (check Vercel dashboard + deploy history).
   - If unused: `git rm -r api/ vercel.json`
   - If live: apply Phase 3 changes to `api/notify.js`; document dual-platform decision in README
2. `git rm src/slack/index.js`
3. In `airtable.js` ~line 133: remove `const sort = encodeURIComponent(...)` dead variable
4. `npm run lint` exits 0

---

## Definition of Done

Implementation is complete only when **all** of the following are true:

- [ ] `npm test` exits 0 — all tests pass, no skips for patched areas
- [ ] `npm run lint` exits 0 — zero warnings
- [ ] `npm run build:cjs` exits 0 — generated files match `src/core/` sources
- [ ] Netlify deploy log shows zero build errors
- [ ] Cold-start log shows `signingSecret=true botToken=true adminToken=true`
- [ ] All per-phase acceptance criteria above are checked off
- [ ] **Regression — export:** End-to-end export flow works in production Slack; signed URL opens and downloads correctly
- [ ] **Regression — modals:** All 5 view_submission flows complete (HR reply, resolve, reassign, upload doc, manager reply)
- [ ] **Regression — notify:** Unauthenticated POST to `/api/notify` returns 401
- [ ] **Regression — RIF:** RIF scenario in Slack displays 3 next steps per risk tier
- [ ] **Regression — slash command:** `/pac` responds in Slack without error
- [ ] No occurrence of `PAC_ADMIN_TOKEN` in any Slack message URL (grep confirms)
- [ ] `activeToken` does not appear in `pac-slack.js` (grep confirms)
