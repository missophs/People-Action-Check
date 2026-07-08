# People Action Check — Technical Specification
**Version:** 1.0  
**Date:** 2026-07-08  
**Author:** Senior Software Architect  
**Input:** AUDIT.md (2026-07-08, 17 findings)  
**Status:** Draft — ready for implementation

---

## Executive Summary

The audit identified six root cause groups that cut across files rather than being isolated bugs. This specification resolves all six by organizing work into four implementation phases, each of which closes a complete subsystem gap:

1. **Credential & Auth Subsystem** — eliminates token exposure and unauthenticated proxy (CRIT-01, MED-04)
2. **Slack Handler Subsystem** — deferred-ack pattern + per-invocation token derivation (HIGH-01, HIGH-02)
3. **Shared Logic Subsystem** — single source of truth for scoring and scenario data, eliminating drift (MED-01, MED-02, MED-03)
4. **Quality & Hygiene Subsystem** — test suite restored, dead code removed, platform ambiguity resolved (9 failures, AR-1, MED-05, AR-5)

No application behavior changes. No new external dependencies required. Phases are independently deployable.

---

## Goals

- Eliminate the `PAC_ADMIN_TOKEN` credential leak (CRIT-01)
- Make all Slack view_submission handlers safe under the 3-second deadline (HIGH-01)
- Remove shared mutable state from Lambda handlers (HIGH-02)
- Close the SSRF vector in the webhook proxy (MED-04)
- Establish a single authoritative source for scoring logic and scenario data, consumed by both ESM and CJS runtimes (MED-02, MED-03)
- Guard the divide-by-zero path in `computeScore` on all surfaces (MED-01)
- Restore all 9 failing tests to passing
- Establish minimum coverage for all previously untested critical paths

---

## Non-Goals

- Rewriting the application in TypeScript (out of scope)
- Migrating from Netlify Functions to another platform
- Adding new product features
- Redesigning the Block Kit UI
- Changing data storage backends
- Adding a message queue or external job processor
- Modifying `verifySignature` in any way

---

## Current Architecture

```
root/
├── src/                         ESM — web app (React + scoring core)
│   ├── core/
│   │   ├── scenarios.js         Canonical scenario/question/NEXT_STEPS data (ESM)
│   │   └── scoring.js           Canonical computeScore (ESM, guarded)
│   ├── web/
│   │   └── app-utils.js         Legacy global-scope computeScore (unguarded copy)
│   └── slack/
│       └── index.js             Scaffold stub, never imported
├── netlify/functions/           CJS — Netlify Lambda runtime
│   ├── pac-slack.js             Monolithic Slack event handler (1196 lines)
│   ├── export-cases.js          Export endpoint; auth via ?token= query param
│   ├── notify.js                Unauthenticated outbound webhook proxy
│   ├── save-hr-email.js         Bearer-auth admin write
│   ├── get-hr-email.js          Public admin read
│   ├── send-report-email.js     Brevo email sender
│   └── lib/
│       ├── pac-blocks.js        Block Kit builders (1596 lines); owns CJS computeScore copy
│       ├── pac-data.js          CJS copy of scenario data; RIF NEXT_STEPS diverged
│       ├── data-store.js        Storage backend router
│       ├── blob-store.js        Netlify Blobs wrapper
│       └── stores/
│           ├── airtable.js      Airtable backend (dead sort variable)
│           ├── supabase.js      Supabase backend
│           └── netlify-blob.js  Netlify Blob backend
├── api/
│   └── notify.js                Vercel-format duplicate of netlify/functions/notify.js
├── tests/                       Vitest; 9 currently failing
├── netlify.toml                 Netlify deployment config
└── vercel.json                  Vercel deployment config (dual-platform ambiguity)
```

### Runtime Split

| Layer | Module format | Runtime |
|-------|--------------|---------|
| `src/` | ESM (`"type":"module"`) | Browser / Vitest |
| `netlify/functions/` | CJS (`{"type":"commonjs"}`) | Node.js Lambda |

Shared logic (scoring, scenario data) crosses this boundary via **manual duplication** — no build step generates the CJS copy.

---

## Problems Identified

| ID | Subsystem | Problem |
|----|-----------|---------|
| CRIT-01 | Auth | `PAC_ADMIN_TOKEN` emitted in Slack DM as URL query parameter |
| HIGH-01 | Slack Handler | 5 view_submission handlers exceed 3-second Slack ack deadline |
| HIGH-02 | Slack Handler | Module-level `activeToken` mutable; concurrent Lambda race |
| MED-01 | Shared Logic | `app-utils.js computeScore` has no zero-weight guard → NaN |
| MED-02 | Shared Logic | Three independent `computeScore` implementations, different return shapes |
| MED-03 | Shared Logic | RIF `NEXT_STEPS` in CJS pac-data.js has 1 step vs 3 in ESM scenarios.js |
| MED-04 | Auth | `notify.js` is an unauthenticated SSRF proxy |
| MED-05 | Hygiene | Dead `sort` variable in `airtable.js` |
| AR-1 | Hygiene | `vercel.json` + `api/` coexist with `netlify.toml` + `netlify/functions/` |
| AR-5 | Hygiene | `src/slack/index.js` scaffold stub never imported |
| T-1–9 | Tests | 9 failing tests across 3 test files |

---

## Root Cause Mapping

```
RCG-1: Credential Handling Design
  └── CRIT-01  (token in URL → visible to Slack, logs, history)
  └── AR-4     (export-cases.js ?token= design enables the exposure)

RCG-2: Async/Lambda Timing
  └── HIGH-01  (all view_submission handlers synchronous before ack)

RCG-3: Shared Mutable State in Lambda
  └── HIGH-02  (activeToken module-level, reset per invocation, race window)

RCG-4: ESM/CJS Manual Duplication
  └── MED-02   (computeScore triplicated)
  └── MED-03   (RIF NEXT_STEPS diverged)
  └── MED-01   (copy in app-utils.js missed the guard)

RCG-5: Test Suite Staleness
  └── T-1–9   (tests encode old UI, not updated after redesign)

RCG-6: No Input Validation on Proxy
  └── MED-04  (notify.js proxies to arbitrary URL, no auth)
```

---

## Proposed Architecture

### Guiding Principles

1. **One source of truth per domain concept.** Scoring logic lives in `src/core/scoring.js` only. Scenario data lives in `src/core/scenarios.js` only. CJS consumers `require()` a generated bridge file produced at build time — not a manually maintained copy.

2. **Request context is per-invocation, never module-level.** All state derived from an incoming Slack request (workspace token, user ID, team ID) is passed as function arguments, not stored in module scope.

3. **Ack immediately, process asynchronously.** Every Slack view_submission handler returns the HTTP `200` before performing any I/O. Work happens in the same Lambda invocation's event loop after ack, using Node.js's non-blocking guarantees.

4. **Credentials never travel as URL query parameters.** Export authentication moves to `Authorization: Bearer` header. The Slack surface receives a server-side redirect or a Lambda-generated file, not a credentialed URL.

5. **Proxy endpoints are authenticated and domain-scoped.** `notify.js` accepts only URLs matching an explicit allowlist derived from environment configuration.

### Architecture Diagram

```
Slack Events
    │
    ▼
pac-slack.js (entry point)
    │  verifySignature (NEVER MODIFIED)
    │  ack() ◄── returns 200 immediately
    │
    ├── resolveContext(event) ──► { token, teamId, userId }  [per-invocation, no module state]
    │
    ├── handlers/
    │   ├── slash.js            /pac slash command
    │   ├── home.js             app_home_opened
    │   ├── action.js           block_actions
    │   └── submission.js       view_submission  [acks first, then processes]
    │
    ├── lib/
    │   ├── pac-blocks.js       Block Kit builders (no scoring logic)
    │   ├── pac-data.cjs        AUTO-GENERATED from src/core/scenarios.js
    │   ├── scoring.cjs         AUTO-GENERATED from src/core/scoring.js
    │   ├── data-store.js       Storage backend router (unchanged)
    │   └── stores/             (unchanged)
    │
    └── security/
        └── export-token.js     Signs/verifies short-lived export tokens (HMAC, no PAC_ADMIN_TOKEN in URL)

export-cases.js
    │  auth: Authorization: Bearer PAC_ADMIN_TOKEN   [never ?token=]
    │  OR:   ?sig=<hmac>&exp=<ts>  for Slack-generated links

notify.js
    │  auth: Authorization: Bearer PAC_ADMIN_TOKEN
    │  allowlist: NOTIFY_ALLOWED_DOMAINS env var
```

---

## Folder Structure

```
root/
├── src/
│   ├── core/
│   │   ├── scenarios.js         ← unchanged; single source of truth
│   │   └── scoring.js           ← unchanged; single source of truth
│   └── web/
│       └── app-utils.js         ← MODIFIED: delete computeScore, import from src/core/scoring.js
├── netlify/functions/
│   ├── pac-slack.js             ← MODIFIED: extract handler modules, remove activeToken, ack-first
│   ├── export-cases.js          ← MODIFIED: accept Bearer header; accept signed ?sig= token
│   ├── notify.js                ← MODIFIED: add Bearer auth + domain allowlist
│   ├── save-hr-email.js         ← unchanged
│   ├── get-hr-email.js          ← unchanged
│   ├── send-report-email.js     ← unchanged
│   └── lib/
│       ├── pac-blocks.js        ← MODIFIED: remove local computeScore; import scoring.cjs
│       ├── pac-data.cjs         ← GENERATED (replaces pac-data.js for shared scenario data)
│       ├── scoring.cjs          ← GENERATED (replaces manual copy of computeScore)
│       ├── export-token.js      ← NEW: short-lived signed token for Slack export links
│       ├── resolve-context.js   ← NEW: per-invocation workspace context (replaces activeToken)
│       ├── data-store.js        ← unchanged
│       ├── blob-store.js        ← unchanged
│       └── stores/
│           ├── airtable.js      ← MODIFIED: remove dead sort variable
│           ├── supabase.js      ← unchanged
│           └── netlify-blob.js  ← unchanged
├── scripts/
│   └── build-cjs-bridge.js      ← NEW: generates pac-data.cjs and scoring.cjs from ESM source
├── api/
│   └── notify.js                ← REMOVE (dead Vercel duplicate)
├── tests/
│   ├── core/                    ← unchanged
│   ├── slack/
│   │   ├── pac-blocks.test.js   ← MODIFIED: align to current UI
│   │   ├── interaction.test.js  ← MODIFIED: fix "Attach Files" label assertion
│   │   ├── pac-data-sync.test.js ← passes after MED-03 fix via build
│   │   ├── export-token.test.js ← NEW
│   │   ├── notify.test.js       ← NEW
│   │   └── submission.test.js   ← NEW: covers 5 view_submission handlers
│   └── regression/              ← unchanged
├── src/slack/index.js           ← REMOVE (scaffold stub)
├── vercel.json                  ← REMOVE
├── netlify.toml                 ← unchanged
└── package.json                 ← MODIFIED: add build:cjs script
```

---

## Module Responsibilities

### `scripts/build-cjs-bridge.js` (NEW)
- Reads `src/core/scenarios.js` (ESM) and `src/core/scoring.js` (ESM)
- Emits `netlify/functions/lib/pac-data.cjs` and `netlify/functions/lib/scoring.cjs` as CJS (`module.exports = ...`)
- Run via `npm run build:cjs` before deploy and in CI
- Output files are committed (or gitignored and generated at build time — see Open Questions)

### `netlify/functions/lib/export-token.js` (NEW)
- `sign(payload, ttlSeconds)` → opaque token string (HMAC-SHA256 over `JSON.stringify({payload, exp})`, base64url-encoded, using `EXPORT_TOKEN_SECRET` env var)
- `verify(token)` → `payload` or throws if expired/invalid
- TTL: 300 seconds (5 minutes) — enough for a user to click the link
- Used by `pac-slack.js` to embed in export links; validated by `export-cases.js`
- `PAC_ADMIN_TOKEN` is never involved in URL construction

### `netlify/functions/lib/resolve-context.js` (NEW)
- `resolveContext(event)` → `{ token, teamId, userId, botToken }`
- Derives workspace bot token from `event` payload (team_id → env var lookup)
- Pure function: no module-level mutable state
- Called once at the top of each `pac-slack.js` invocation; result passed as argument to all handlers

### `pac-slack.js` (MODIFIED)
- Entry point only: signature verification, routing, `resolveContext()`, `ack()`
- All handler logic moves to `lib/handlers/` (or inline named functions — see Open Questions)
- `ack('')` called **before** any `await` in view_submission branches
- `activeToken` module-level mutable removed entirely

### `export-cases.js` (MODIFIED)
- Accepts `Authorization: Bearer <PAC_ADMIN_TOKEN>` for direct API calls (unchanged behavior for non-Slack callers)
- **Also** accepts `?sig=<signed-token>` for Slack-generated links (new path; signed token verified via `export-token.js`)
- Removes `?token=<PAC_ADMIN_TOKEN>` path entirely (breaking change for any existing bookmarked URLs — see Migration Strategy)

### `notify.js` (MODIFIED)
- Requires `Authorization: Bearer <PAC_ADMIN_TOKEN>` on every request
- Validates `webhookUrl` against `NOTIFY_ALLOWED_DOMAINS` env var (comma-separated hostname list, e.g. `hooks.slack.com,hooks.office.com`)
- Rejects any URL not matching allowlist with `403 Forbidden`

### `src/web/app-utils.js` (MODIFIED)
- Removes local `computeScore` implementation
- Imports and re-exports from `src/core/scoring.js`
- All callers continue to work; return shape expands to 8 fields (additive, not breaking)

### `netlify/functions/lib/pac-blocks.js` (MODIFIED)
- Removes local `computeScore` implementation (line 45 area)
- `require('./scoring.cjs')` instead
- No other changes to block-building logic

### `netlify/functions/lib/stores/airtable.js` (MODIFIED)
- Remove dead `const sort = ...` variable
- Inline the sort string directly in the URL construction, or extract to a named constant that is actually used

---

## Dependency Boundaries

```
src/core/scenarios.js ──► (build) ──► netlify/functions/lib/pac-data.cjs
src/core/scoring.js   ──► (build) ──► netlify/functions/lib/scoring.cjs

netlify/functions/lib/scoring.cjs
    ▲
    └── pac-blocks.js (require)

netlify/functions/lib/pac-data.cjs
    ▲
    └── pac-blocks.js (require)
    └── pac-slack.js  (require, for scenario list)

netlify/functions/lib/export-token.js
    ▲
    └── pac-slack.js  (sign)
    └── export-cases.js (verify)

netlify/functions/lib/resolve-context.js
    ▲
    └── pac-slack.js  (called once per invocation)

RULE: netlify/functions/** MUST NOT import from src/**  (CJS/ESM boundary)
RULE: src/** MUST NOT import from netlify/functions/**
RULE: build script is the only crossing point
```

---

## Data Flow

### Export Link (CRIT-01 fix)

**Before:**
```
User requests export
  → pac-slack.js builds URL: /api/export-cases?token=PAC_ADMIN_TOKEN&...
  → URL sent to user in Slack DM
  → User clicks → export-cases.js checks ?token===PAC_ADMIN_TOKEN
```

**After:**
```
User requests export
  → pac-slack.js calls exportToken.sign({ userId, format, filter }, 300)
  → URL sent to user: /api/export-cases?sig=<hmac-token>&format=...
  → User clicks → export-cases.js calls exportToken.verify(sig)
  → On valid/unexpired sig: serve export
  → PAC_ADMIN_TOKEN never appears in any URL
```

### Slack View Submission (HIGH-01 fix)

**Before:**
```
Slack sends view_submission
  → pac-slack.js await getCase() → await updateCase() → await postMessage()
  → ack('') returned  [potentially > 3 seconds]
```

**After:**
```
Slack sends view_submission
  → pac-slack.js captures { caseId, userId, token, values } from event (sync)
  → ack('') returned immediately  [< 100ms]
  → event loop continues: await getCase() → await updateCase() → await postMessage()
  → Lambda stays alive until microtask queue drains (Node.js guarantee)
```

### Workspace Token Resolution (HIGH-02 fix)

**Before:**
```
module level: let activeToken = null
handler entry: activeToken = null; ... activeToken = lookup(teamId)
  [race window between null and re-assignment]
```

**After:**
```
handler entry: const { token } = resolveContext(event)
  [pure function, result scoped to const, no module state]
```

---

## Public Interfaces

### `export-token.js`

```js
// sign(payload, ttlSeconds) → string
// verify(token) → payload (throws ExportTokenExpiredError | ExportTokenInvalidError)

const { sign, verify } = require('./export-token');
```

### `resolve-context.js`

```js
// resolveContext(event) → { teamId, userId, token, botId }
// Throws ResolveContextError if teamId not found in env

const { resolveContext } = require('./resolve-context');
```

### `pac-data.cjs` (generated)

```js
// Same shape as current pac-data.js exports
// module.exports = { QUESTIONS, SCENARIOS, NEXT_STEPS, WEIGHTS, ... }
// Generated by: npm run build:cjs

const { QUESTIONS, NEXT_STEPS } = require('./pac-data.cjs');
```

### `scoring.cjs` (generated)

```js
// Same interface as src/core/scoring.js
// module.exports = { computeScore }
// Return shape: { level, hasCriticalFlag, ratio, countYes, countNo, countUnknown, totalWeight, weightedNo }

const { computeScore } = require('./scoring.cjs');
```

---

## Files To Create

| File | Reason |
|------|--------|
| `scripts/build-cjs-bridge.js` | Single build step replacing manual ESM→CJS duplication |
| `netlify/functions/lib/export-token.js` | Short-lived signed token for export links (replaces `?token=` credential) |
| `netlify/functions/lib/resolve-context.js` | Per-invocation workspace context (replaces `activeToken` mutable) |
| `tests/slack/export-token.test.js` | Coverage for sign/verify/expiry/tamper |
| `tests/slack/notify.test.js` | Coverage for auth enforcement and domain allowlist |
| `tests/slack/submission.test.js` | Coverage for all 5 view_submission handlers (ack-first behavior + business logic) |

---

## Files To Modify

| File | Change | Audit Ref |
|------|--------|-----------|
| `netlify/functions/pac-slack.js` | Remove `activeToken` mutable; call `resolveContext()`; ack before await in all 5 submission handlers; use `exportToken.sign()` for export links | HIGH-01, HIGH-02, CRIT-01 |
| `netlify/functions/export-cases.js` | Accept `Authorization: Bearer` and `?sig=` signed token; remove `?token=` path | CRIT-01 |
| `netlify/functions/notify.js` | Add `Authorization: Bearer PAC_ADMIN_TOKEN` check; add domain allowlist from `NOTIFY_ALLOWED_DOMAINS` env var | MED-04 |
| `netlify/functions/lib/pac-blocks.js` | Replace inline `computeScore` with `require('./scoring.cjs')` | MED-02 |
| `netlify/functions/lib/stores/airtable.js` | Remove dead `sort` variable | MED-05 |
| `src/web/app-utils.js` | Replace inline `computeScore` with import from `src/core/scoring.js` | MED-01, MED-02 |
| `tests/slack/pac-blocks.test.js` | Align 7 failing assertions to current UI structure | T-1 through T-7 |
| `tests/slack/interaction.test.js` | Fix "Upload" → "Attach Files" label assertion | T-8 |
| `package.json` | Add `"build:cjs": "node scripts/build-cjs-bridge.js"` script; add to pre-deploy | AR-2 |

---

## Files To Remove

| File | Reason |
|------|--------|
| `api/notify.js` | Vercel-format dead duplicate of `netlify/functions/notify.js` |
| `vercel.json` | Dead Vercel config; project deploys on Netlify |
| `src/slack/index.js` | Scaffold stub, never imported, `SCAFFOLD_STATUS = 'pending-phase-3'` |
| `netlify/functions/lib/pac-data.js` | Replaced by generated `pac-data.cjs` — see Open Questions |

> **Note on `pac-data.js` removal:** This is the highest-risk removal. The generated `pac-data.cjs` must have identical exports. See Migration Strategy and Open Questions.

---

## Migration Strategy

### CRIT-01: Token Rotation + URL Change

The `?token=PAC_ADMIN_TOKEN` URL pattern is being retired. Any Slack messages already sent with the old URL will stop working on deploy.

Steps:
1. Deploy `export-token.js` + modified `export-cases.js` that accepts **both** old `?token=` and new `?sig=` — 48-hour grace period
2. Deploy modified `pac-slack.js` that generates `?sig=` links
3. After 48 hours: remove `?token=` acceptance from `export-cases.js`
4. Rotate `PAC_ADMIN_TOKEN` in Netlify env vars after step 3

This two-step deploy avoids a hard cutover and allows any in-flight links to still work during transition.

### ESM/CJS Bridge

1. Write `scripts/build-cjs-bridge.js`
2. Run manually: `node scripts/build-cjs-bridge.js` — inspect output `pac-data.cjs` and `scoring.cjs`
3. Verify `tests/slack/pac-data-sync.test.js` passes against generated output
4. Add `build:cjs` to `package.json` and to Netlify build command in `netlify.toml`
5. Remove `pac-data.js` only after CI passes with generated file

### `activeToken` Race

Straightforward in-place refactor. `resolveContext()` is a pure function added to `lib/`; `pac-slack.js` calls it at handler entry and passes result to all sub-calls. No deploy sequencing needed.

---

## Risk Analysis

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Grace-period URLs (old `?token=`) used after cutover | Low | Two-step deploy + token rotation timing |
| Generated `pac-data.cjs` diverges from hand-written `pac-data.js` during transition | Medium | `pac-data-sync.test.js` covers this; do not remove `pac-data.js` until tests pass against generated file |
| RIF NEXT_STEPS content exceeds Block Kit text field limits (Slack max: 3000 chars per text block) | Low | Verify character count of 3-step content before commit |
| Deferred-ack pattern: Lambda exits before background work completes | Low | Lambda stays alive while event loop has pending microtasks; all background work is within same invocation |
| `resolve-context.js` throws for unknown team in multi-workspace setup | Medium | Function must return a safe fallback or error that acks cleanly rather than timing out |
| Removing `api/notify.js` breaks an undiscovered caller | Low | `grep` for `api/notify` in all configs and client code before removal |

---

## Test Strategy

### Existing tests (9 failures → 0)

**`pac-blocks.test.js` (7 failures):**
Read current `slashResponseBlocks`, `caseListBlocks`, `homeTabView` implementations and update assertions to match actual output. Do not change production code to match old tests — the tests encode the old UI, not a bug in current code.

**`interaction.test.js` (1 failure):**
Change assertion from `"Upload"` to `"Attach Files"` to match current button label in `pac-blocks.js`.

**`pac-data-sync.test.js` (1 failure):**
Passes automatically once `pac-data.cjs` is generated from `src/core/scenarios.js` (includes 3-step RIF NEXT_STEPS).

### New test files

**`tests/slack/export-token.test.js`**
- `sign()` returns a non-empty string
- `verify(sign(payload, 300))` returns original payload
- `verify()` throws `ExportTokenExpiredError` on expired token (mock `Date.now`)
- `verify()` throws `ExportTokenInvalidError` on tampered token
- Token does not contain `PAC_ADMIN_TOKEN` value

**`tests/slack/notify.test.js`**
- Missing `Authorization` header → 401
- Wrong token → 401
- Valid token, URL on allowlist → proxies request
- Valid token, URL not on allowlist → 403
- Valid token, `NOTIFY_ALLOWED_DOMAINS` not set → 500 (misconfiguration)
- Valid token, `webhookUrl` missing from body → 400

**`tests/slack/submission.test.js`**
Each of the 5 view_submission handlers (`MODAL_HR_REPLY`, `MODAL_HR_RESOLVE`, `MODAL_MGR_REPLY`, `MODAL_UPLOAD_DOC`, `MODAL_HR_REASSIGN`):
- Handler calls `ack()` before first `await` (spy on ack; assert called before any stub resolves)
- Handler updates case state correctly (mock `dataStore`)
- Handler sends Slack message (mock `slackClient`)
- Handler does not throw when optional fields are absent

### Coverage targets

| Module | Target |
|--------|--------|
| `export-token.js` | 100% lines |
| `resolve-context.js` | 100% lines |
| `notify.js` | Auth paths + allowlist: 100%; proxy behavior: covered |
| `submission.js` (5 handlers) | All branches, ack-first ordering |
| `app-utils.js computeScore` | `total === 0` path explicitly asserted |

---

## Acceptance Criteria

### Phase 1 (Credential & Auth)
- `PAC_ADMIN_TOKEN` does not appear in any string passed to any Slack API call
- Export links sent via Slack expire after 300 seconds
- `export-cases.js` returns 401 for requests with missing or invalid auth, regardless of method
- `notify.js` returns 401 without `Authorization: Bearer <PAC_ADMIN_TOKEN>`
- `notify.js` returns 403 for URLs not matching `NOTIFY_ALLOWED_DOMAINS`
- All export-token tests pass

### Phase 2 (Slack Handler)
- All 5 view_submission handlers call `ack()` within 200ms of invocation start (measured in test via spy)
- `activeToken` does not appear in `pac-slack.js` source
- `resolveContext` is called exactly once per invocation
- All submission handler tests pass

### Phase 3 (Shared Logic)
- `npm run build:cjs` exits 0 and produces `pac-data.cjs` and `scoring.cjs`
- `pac-data-sync.test.js` passes (RIF NEXT_STEPS: 3 steps per tier in both CJS and ESM)
- `app-utils.js computeScore({ questions: [] })` returns `{ level: 'good', ratio: 0, ... }` (no NaN)
- `pac-blocks.js computeScore` and `app-utils.js computeScore` return identical shapes for same input

### Phase 4 (Hygiene)
- `api/`, `vercel.json`, `src/slack/index.js` do not exist in repo
- `airtable.js` contains no unused variable declarations
- All 289 tests pass (280 already passing + 9 fixed)
- `npm test` exits 0

---

## Rollback Strategy

Each phase is independently deployable and independently rollbackable via Netlify's instant rollback (previous deploy button).

**Phase 1 rollback risk:** If rolled back after token rotation, old `?token=` URLs stop working (token already rotated). Mitigation: do not rotate `PAC_ADMIN_TOKEN` until step 3 of migration is stable for 24 hours.

**Phase 2 rollback:** No data model changes; clean rollback.

**Phase 3 rollback:** If `pac-data.cjs` generation is reverted, restore `pac-data.js` from git. The sync test will catch any re-divergence.

**Phase 4 rollback:** File deletions are reversible via `git revert`.

---

## Open Questions

1. **Should generated `pac-data.cjs` and `scoring.cjs` be committed to git, or gitignored and generated at build time?**  
   Committing them makes the repo self-contained and CI simpler; gitignoring them means the build step is mandatory and drift is impossible. Recommendation: gitignore, generate in `netlify.toml` build command. Decide before Phase 3 begins.

2. **What is `EXPORT_TOKEN_SECRET` seeded from?**  
   A separate secret from `PAC_ADMIN_TOKEN` is needed to sign short-lived export tokens. Should it be a new Netlify env var, or derived from an existing secret? Must be decided before Phase 1 implementation.

3. **What is the authoritative list of domains for `NOTIFY_ALLOWED_DOMAINS`?**  
   Must be confirmed before Phase 1. If `notify.js` currently proxies only to Slack webhooks, the list is `hooks.slack.com`. If it proxies to other services, enumerate them before adding the allowlist.

4. **Is `api/notify.js` actually invoked anywhere (Vercel deployment)?**  
   Before deletion, confirm via `grep` across all client code, CI configs, and Netlify/Vercel dashboards. If it is live on a Vercel deployment, removal requires decommissioning the Vercel project first.

5. **`pac-data.js` removal timing:** Should the hand-written file be kept as a fallback during the Phase 3 transition, renamed to `pac-data.legacy.js`, or deleted immediately when the generated file is confirmed? Recommend keeping it until the first full CI pass with generated output.

---

## Implementation Phases

### Phase 1 — Credential & Auth Subsystem
**Closes:** CRIT-01, MED-04, AR-4  
**Root cause:** RCG-1 (Credential Handling Design), RCG-6 (No Input Validation on Proxy)

1. Add `EXPORT_TOKEN_SECRET` to Netlify env vars
2. Create `netlify/functions/lib/export-token.js`
3. Modify `export-cases.js`: add `?sig=` path; keep `?token=` path temporarily (grace period)
4. Modify `pac-slack.js`: replace `?token=` URL construction with `exportToken.sign()`
5. Modify `notify.js`: add Bearer auth + `NOTIFY_ALLOWED_DOMAINS` allowlist
6. Write `tests/slack/export-token.test.js` and `tests/slack/notify.test.js`
7. Deploy; verify export links work end-to-end
8. After 48 hours: remove `?token=` path from `export-cases.js`; rotate `PAC_ADMIN_TOKEN`

---

### Phase 2 — Slack Handler Subsystem
**Closes:** HIGH-01, HIGH-02  
**Root cause:** RCG-2 (Async/Lambda Timing), RCG-3 (Shared Mutable State)

1. Create `netlify/functions/lib/resolve-context.js`
2. Modify `pac-slack.js`:
   - Remove `let activeToken = null`
   - Add `const ctx = resolveContext(event)` at handler entry
   - Pass `ctx.token` to all downstream calls as argument (no module state)
   - Restructure all 5 view_submission branches: extract sync context capture, call `ack('')`, then perform awaits
3. Write `tests/slack/submission.test.js`
4. Deploy

---

### Phase 3 — Shared Logic Subsystem
**Closes:** MED-01, MED-02, MED-03, AR-2  
**Root cause:** RCG-4 (ESM/CJS Manual Duplication)

1. Write `scripts/build-cjs-bridge.js`
2. Run build script; inspect `pac-data.cjs` and `scoring.cjs` output
3. Verify `pac-data-sync.test.js` passes against generated output
4. Modify `netlify/functions/lib/pac-blocks.js`: replace inline `computeScore` with `require('./scoring.cjs')`
5. Modify `src/web/app-utils.js`: replace inline `computeScore` with import from `src/core/scoring.js`
6. Add `build:cjs` script to `package.json`; add to `netlify.toml` build command
7. Run full test suite; confirm 0 failures
8. Remove `netlify/functions/lib/pac-data.js` (hand-written copy)

---

### Phase 4 — Quality & Hygiene Subsystem
**Closes:** T-1–9, AR-1, AR-5, MED-05  
**Root cause:** RCG-5 (Test Suite Staleness), dead code

1. Fix `tests/slack/pac-blocks.test.js` (7 assertions): align to current `slashResponseBlocks`, `caseListBlocks`, `homeTabView` output
2. Fix `tests/slack/interaction.test.js` (1 assertion): `"Upload"` → `"Attach Files"`
3. Remove `api/notify.js`, `vercel.json`, `src/slack/index.js`
4. Fix dead `sort` variable in `netlify/functions/lib/stores/airtable.js`
5. Run full test suite; confirm all 289 pass

---

## Definition of Done

Implementation is complete only when **all** of the following are true:

- [ ] `npm test` exits 0 — all 289 tests pass (280 existing + 9 fixed), plus all new tests
- [ ] `node --check` exits 0 on every file in `netlify/functions/`
- [ ] `npm run build:cjs` exits 0 and produces valid `pac-data.cjs` and `scoring.cjs`
- [ ] `netlify dev` starts without errors
- [ ] Slack `/pac` slash command responds with correct Block Kit modal
- [ ] Export link received via Slack DM does not contain `PAC_ADMIN_TOKEN` as a query parameter
- [ ] Export link expires and returns 401 after 300 seconds
- [ ] `notify.js` returns 401 without `Authorization: Bearer` header
- [ ] `notify.js` returns 403 for URLs outside `NOTIFY_ALLOWED_DOMAINS`
- [ ] RIF scenario in Slack shows 3 next-steps per tier (matches web app)
- [ ] `computeScore` with zero questions returns `ratio: 0`, not `NaN`, on all three callers
- [ ] `api/`, `vercel.json`, `src/slack/index.js` do not exist in the repository
- [ ] All acceptance criteria from each phase are verified
- [ ] Regression tests pass (no regressions introduced)
- [ ] `PAC_ADMIN_TOKEN` rotated after Phase 1 grace period

---

*Specification complete. No production code was written or modified during this specification.*
