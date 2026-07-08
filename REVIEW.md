# People Action Check — Principal Engineer Code Review
**Date:** 2026-07-08  
**Reviewer:** Principal Engineer  
**Inputs:** AUDIT.md · SPEC.md · VERIFY.md · codebase (branch `pac-enterprise-slack-build`)  
**Scope:** Architecture, code quality, maintainability, scalability, and production readiness  
**Constraint:** No code written or modified. No tests re-run. Evidence cited from file reads only.

> **Important context:** VERIFY.md (2026-07-08) confirmed that the SPEC.md implementation has not been started. This review evaluates the codebase as it actually exists — not a hypothetical completed state. Findings from AUDIT.md that remain unaddressed are treated as production defects, not audit items awaiting remediation.

---

## Executive Review

People Action Check is a functionally coherent application with several excellent architectural choices (the `governance.js` naming registry, the `data-store.js` backend router, `email-notify.js` as a dedicated service module) that suggest a codebase with intent and design thought. The canonical scoring module (`src/core/scoring.js`) in particular is a model of clean, well-documented domain logic.

However, the codebase has a critical unresolved security defect (`PAC_ADMIN_TOKEN` in Slack-facing URLs), a concurrent-Lambda race condition on module-level state, an unauthenticated SSRF proxy endpoint, and three independent implementations of the same scoring function — one of which has a divide-by-zero defect. These are not backlog items; they are active production risks.

The two primary files — `pac-slack.js` (1,195 lines) and `pac-blocks.js` (1,596 lines) — carry the majority of the application behavior in monolithic structures that are difficult to test in isolation and will accumulate coupling over time. The ESM/CJS split across `src/` and `netlify/functions/lib/` is managed by hand duplication with no build-time enforcement, which has already produced a data divergence that the test suite detects but cannot self-heal.

The SPEC.md provides a sound remediation plan. None of it has been applied.

---

## Architecture Review

### What Works Well

**`governance.js` — Naming Authority Pattern**  
`ACTION_IDS`, `CALLBACK_IDS`, `BLOCK_IDS`, and `AUDIT_EVENTS` are all declared in a single 180-line registry that is imported by both `pac-slack.js` and `pac-blocks.js`. This eliminates magic strings across 2,800 lines of handler and builder code. It is the single best architectural decision in the codebase. Violations (a handler introducing a new ID without registering it) are immediately detectable via grep.

**`data-store.js` — Backend Router Pattern**  
Clean 6-method interface (`getCase`, `saveCase`, `findCaseById`, `listCasesForManager`, `listAllCases`, `deleteCase`) with runtime selection via `PAC_DATA_STORE` env var. Switching between Netlify Blobs, Supabase, and Airtable requires only an environment variable change. All backends conform to the same interface. This is correct and scalable.

**`email-notify.js` — Dedicated Service Module**  
275 lines handling all Brevo API communication, HTML generation, and file download from Slack. Single responsibility, single file. The separation from `pac-slack.js` is appropriate and makes the email concern testable in isolation.

**`src/core/scoring.js` — Canonical Domain Logic**  
Named constants for thresholds (`RISK_THRESHOLDS.LOW = 0.15`), named constants for answer values (`ANSWERS.YES/NO/UNKNOWN`), zero-weight guard, 8-field return with full observability (`countYes`, `countNo`, `countUnknown`, `totalWeight`, `weightedNo`), exported helpers (`isComplete`, `computeLiveLevel`). This module is the standard the rest of the codebase should follow.

**`MODAL_QUESTIONS` — Deferred Ack Pattern (Correctly Implemented)**  
The most critical handler already uses the correct pattern: all I/O is wrapped in a fire-and-forget IIFE before the synchronous `return ack(...)`. This is the right approach.

```js
// Background: save, DM, HR notify, App Home refresh — no timing constraint
(async () => { ... await saveCase(); await postMessage(); ... })();

// Replace questions modal with result modal — no await before this
return ack({ response_action: 'update', view: resultModal(...) });
```

---

### What Does Not Work

**Monolith Architecture — `pac-slack.js` and `pac-blocks.js`**

At 1,195 and 1,596 lines respectively, these files cannot be tested at the function level without loading the entire module. `pac-blocks.js` exports 30+ block-building functions but testing any one of them requires the entire file's initialization. `pac-slack.js` has at least four logical sub-domains (slash command handling, event callbacks, block actions, view submissions) that share a single namespace and a single module scope — which is precisely how `activeToken` became a module-level mutable.

This is not a style concern. It is a structural constraint that limits testability, increases the cost of every change, and grows worse with every new handler added.

**ESM/CJS Manual Synchronization**

`src/core/scenarios.js` is the canonical source for scenario data. `netlify/functions/lib/pac-data.js` is a hand-maintained CJS copy. There is no build step, no transpiler, no generator — just a `pac-data-sync.test.js` that catches divergence after it has already happened. It currently fails:

```
MISMATCH: Reduction in Force.good  ESM=3  CJS=1
```

This divergence has shipped. The canonical ESM source has 3 next-step items per risk tier for RIF; the Slack surface shows 1. The mechanism guaranteeing parity does not exist.

**`computeScore` — Three Implementations, Diverged**

| Location | Zero-guard | Return fields | Threshold constants |
|----------|-----------|--------------|-------------------|
| `src/core/scoring.js` | ✅ | 8 (`level`, `hasCriticalFlag`, `ratio`, `countYes`, `countNo`, `countUnknown`, `totalWeight`, `weightedNo`) | Named (`RISK_THRESHOLDS`) |
| `netlify/functions/lib/pac-blocks.js:45` | ✅ | 3 (`level`, `hasCriticalFlag`, `ratio`) | Hardcoded (`0.15`, `0.45`) |
| `src/web/app-utils.js:71` | ❌ | 5 (`level`, `crit`, `unk`, `yes`, `no`) | Hardcoded |

The web app's legacy implementation has two compounding defects: `var ratio = wNo/total` with no guard (NaN when `total === 0`), and a return shape that uses abbreviated field names (`crit` instead of `hasCriticalFlag`, `unk` instead of `countUnknown`) that will silently break any caller expecting the canonical shape.

**`activeToken` Module-Level Mutable**

```js
// pac-slack.js:220
let activeToken = null;
// ... reset at line 1156, re-assigned at lines 238/241/245
```

In a warm Lambda with concurrent invocations, this is a race condition window. One request's reset to `null` and subsequent re-assignment is not atomic with respect to another request reading the value between those two operations. The impact is cross-workspace token contamination: a request for workspace A could execute with workspace B's bot token if the timing is right.

**`notify.js` — Unauthenticated SSRF Proxy**

No authentication. No URL validation. Any actor who discovers the Netlify function URL can POST `{"webhookUrl": "http://internal-service/..."}` and use the Lambda's network identity to reach internal targets. The endpoint is 35 lines with no security layer.

**CRIT-01 — Admin Token in Slack Message**

```js
// pac-slack.js:1101-1103
const token = process.env.PAC_ADMIN_TOKEN;
const base  = `${WEB_APP_URL}/api/export-cases?token=${token}&...`;
// base is then sent to Slack user as a clickable link
```

`PAC_ADMIN_TOKEN` is the sole authentication credential for all case data exports. It is placed in a URL that is sent to Slack users, stored in Slack's message history, visible in Slack's API logs, and traverses any network proxy between the Lambda and Slack's servers. This is a production credential leak on every export request.

---

## Maintainability Score: **4 / 10**

| Dimension | Observation |
|-----------|-------------|
| Naming | Strong — `governance.js` registry enforced; `ACTION_IDS.HR_RESOLVE`, `CALLBACK_IDS.MODAL_HR_REPLY` are self-documenting |
| Readability | Mixed — `src/core/scoring.js` is exemplary; `app-utils.js` uses `var`, single-letter accumulators (`wNo`, `crit`), no constants |
| Duplication | High — scoring logic triplicated; scenario data manually duplicated; `notify.js` duplicated across Netlify and Vercel targets |
| Coupling | High — `pac-slack.js` is coupled to `pac-blocks.js`, `pac-data.js`, `email-notify.js`, `blob-store.js`, `data-store.js`, `governance.js` all at module scope |
| Cohesion | Poor within monoliths; good within dedicated modules (`email-notify`, `data-store`, `governance`) |
| Separation of concerns | `pac-slack.js` mixes routing, business logic, state management, and Slack API calls in a single function scope |

The maintainability ceiling is set by the monolith files. Any change to `pac-slack.js` requires understanding the entire 1,195-line context.

---

## Scalability Score: **5 / 10**

| Dimension | Observation |
|-----------|-------------|
| Concurrency | `activeToken` module mutable is a concurrency defect under warm Lambda — see HIGH-02 |
| Backend extensibility | `data-store.js` router is excellent — adding a new backend requires one file and one env var value |
| Handler volume | Flat `if (callbackId === ...)` chain in `handleViewSubmission` will degrade as handler count grows; currently 10 branches |
| Load | `MODAL_QUESTIONS` correctly defers all I/O; 5 HR handlers still synchronous — at load spike, timeouts and double-processing will occur |
| Feature growth | Adding new scenarios, questions, or Slack surfaces requires editing two monoliths simultaneously |

---

## Technical Debt

### Structural Debt (High — affects every change)

**TD-1: Monolith files will only grow.** `pac-slack.js` and `pac-blocks.js` have no natural stopping point. Each new scenario, handler, or surface adds to these files without any structural forcing function. The only extraction mechanism is a deliberate refactor — which SPEC.md proposes (handler modules under `lib/handlers/`) but which has not happened.

**TD-2: Manual ESM/CJS bridge.** Every change to `src/core/scenarios.js` requires a manual corresponding change to `netlify/functions/lib/pac-data.js`. This debt has already produced a production divergence (RIF NEXT_STEPS). It will produce another.

**TD-3: `app-utils.js` legacy scoring.** The `var`-declaration style and abbreviated names suggest this module has not been touched since early in the project. It will continue to be wrong in silent ways (NaN propagation, shape mismatch) until something visible breaks.

### Security Debt (Critical — blocks production approval)

**TD-4: CRIT-01 unaddressed.** Every export request exposes `PAC_ADMIN_TOKEN`.

**TD-5: `notify.js` unauthenticated.** Any caller can use this as an SSRF proxy.

### Test Debt (Medium — reduces confidence)

**TD-6: 9 failing tests committed to main branch.** The tests encode the old UI but have not been updated. They provide no signal in CI — they always fail, so failures are noise rather than alerts.

**TD-7: No coverage for security-critical paths.** Export token auth, `notify.js` input validation, concurrent token routing — none have tests.

---

## Future Risks

**FR-1: Handler fan-out.** `handleViewSubmission` currently has 10 branches. Each new modal adds one. At 20+ branches, the function will be unmaintainable without the module extraction SPEC.md proposes.

**FR-2: Scoring threshold changes.** `pac-blocks.js` hardcodes `0.15` and `0.45`; `src/core/scoring.js` uses `RISK_THRESHOLDS.LOW = 0.15`. If thresholds are adjusted, they must be updated in two places. `app-utils.js` has a third independent copy. A threshold change that only updates the canonical file will silently produce different risk levels on the Slack surface vs the web surface vs the export surface.

**FR-3: Multi-workspace race frequency grows with adoption.** The `activeToken` race is low-probability at low volume. As the number of concurrent Slack events increases, the probability of a cross-workspace token assignment rises proportionally. This is not a theoretical risk — it is a probability function of usage.

**FR-4: Test suite as false safety signal.** 280 passing tests give a feeling of coverage that is not supported by what those tests actually exercise. The security-critical paths (auth, export, SSRF) have zero tests. A CI badge of "280/289 passing" does not mean the application is safe.

**FR-5: Vercel dead code.** `api/notify.js` and `vercel.json` exist alongside `netlify.toml`. If someone applies a security fix to `netlify/functions/notify.js` but does not know about `api/notify.js`, the Vercel deployment (if active) remains vulnerable. The dual-platform ambiguity creates a permanent risk of incomplete patching.

---

## Recommendations

These are ordered by urgency, not by SPEC.md phase.

**R-1 (Immediate): Rotate `PAC_ADMIN_TOKEN` now.**  
The token has been sent to Slack users in URLs. Whether or not code is patched, the existing token value is compromised. Rotating it prevents any previously sent links from working. This is an operational action, not a code change.

**R-2 (Immediate): Add authentication to `notify.js`.**  
Two lines: check `Authorization: Bearer PAC_ADMIN_TOKEN`. This endpoint should never have been deployed without authentication.

**R-3 (This sprint): Implement SPEC.md Phase 1 (Credential & Auth).**  
`export-token.js` and the signed `?sig=` URL pattern eliminate the credential-in-URL pattern at source. Until then, every export request leaks the admin token.

**R-4 (This sprint): Apply deferred-ack to 5 remaining submission handlers.**  
`MODAL_QUESTIONS` already demonstrates the correct pattern. Apply the same IIFE structure to `MODAL_HR_REPLY`, `MODAL_HR_RESOLVE`, `MODAL_MGR_REPLY`, `MODAL_UPLOAD_DOC`, `MODAL_HR_REASSIGN`.

**R-5 (This sprint): Build `scripts/build-cjs-bridge.js`.**  
Two generated files (`pac-data.cjs`, `scoring.cjs`) and a build step in `netlify.toml` eliminate both the manual sync burden and the current RIF divergence.

**R-6 (Next sprint): Fix 9 failing tests; add tests for auth and submission handlers.**  
Failing tests committed to the main branch suppress CI signal. They must be brought to pass or removed.

**R-7 (Next sprint): Resolve dual-platform ambiguity.**  
Determine which platform is live. Delete the dead platform's config and code. Do not apply security patches to `netlify/functions/notify.js` while `api/notify.js` exists unresolved.

**R-8 (Backlog): Begin handler extraction from `pac-slack.js`.**  
Not urgent, but necessary for long-term health. The `handleViewSubmission` function should become a dispatcher; each handler should be its own named module in `lib/handlers/`.

---

## Production Readiness

### Score Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| Architecture | **5 / 10** | Strong patterns (governance registry, backend router) undermined by monolith and manual ESM/CJS sync |
| Code Quality | **6 / 10** | Canonical modules are excellent; legacy `app-utils.js` is var-style with defects; naming is consistently good |
| Maintainability | **4 / 10** | Monolith files, manual data sync, three implementations of one function |
| Testability | **4 / 10** | 9 failing tests; no coverage for auth, SSRF, or submission handler ack timing |
| Scalability | **5 / 10** | Backend router is clean; `activeToken` race and 5 sync-before-ack handlers limit load ceiling |
| **Overall Engineering Quality** | **5 / 10** | Competent structure with well-designed modules, undermined by unresolved critical security findings |

### Production Approval

**NOT APPROVED FOR PRODUCTION.**

Three findings block approval. These are not quality concerns — they are active security defects in deployed code.

**Evidence:**

1. `pac-slack.js:1103` — `PAC_ADMIN_TOKEN` in URL sent to Slack users on every export request:
   ```js
   const base = `${WEB_APP_URL}/api/export-cases?token=${token}&format=${format}${filterParam}`;
   ```

2. `netlify/functions/notify.js` — 35 lines, zero authentication, accepts any `webhookUrl`:
   ```js
   exports.handler = async function (event) {
     // No auth check anywhere in this file
     const r = await fetch(webhookUrl, { method: 'POST', ... });
   ```

3. `pac-slack.js:220` — Module-level mutable token; concurrent Lambda invocations share this state:
   ```js
   let activeToken = null;
   ```

The codebase will be ready for production approval review when SPEC.md Phases 1 and 2 are implemented, VERIFY.md is re-run clean, and R-1 (token rotation) has been executed in the Netlify environment.

The underlying architecture has the structure to support that work. The `governance.js` registry, `data-store.js` router, and `email-notify.js` service module are the right patterns. The `MODAL_QUESTIONS` deferred-ack implementation proves the team knows how to apply the fix. The canonical `src/core/scoring.js` is the model every other scoring-adjacent file should converge to.

This codebase is two sprints away from a 7/10. It is not there yet.

---

*Review complete. No production code was written or modified.*
