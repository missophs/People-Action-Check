# People Action Check — Governance Model

## Overview

PAC governance covers seven domains. Each domain has a designated owner and a defined change process. Governance is built into the architecture — not deferred.

---

## 1. Decision / Policy Governance

**Owner:** Product (Melissa)
**What it covers:** Scenario definitions, question text, weights, critical flags, next-steps content.
**Where it lives:** `src/core/scenarios.js`
**Change process:** Pull request to `pac-enterprise-slack-build` → review → merge. No hot-patching scenario data.
**Why code-controlled:** These are legal-risk-bearing content items. Changes must be reviewed and versioned.

---

## 2. Workflow Governance

**Owner:** Product + Engineering
**What it covers:** Case state machine (NOT_STARTED → ARCHIVED), valid transitions, actor roles.
**Where it lives:** `src/core/workflow.js`
**Change process:** Pull request with updated state diagram in commit description.
**SLA target (Phase 3):** HR acknowledgment within 1 business day of SUBMITTED state.

---

## 3. Design System Governance

**Owner:** Engineering
**What it covers:** Color tokens, typography, spacing — shared between web and Slack Block Kit.
**Where it lives:** `src/config/defaults.js` (current), `src/config/tokens.js` (Phase 3)
**Change process:** Token changes require updating both web and Slack builder files simultaneously.
**Rule:** Never hardcode a hex value or pixel value in a component. Always reference a token.

---

## 4. Slack Governance

**Owner:** Engineering
**What it covers:** App credentials, action ID naming, scope documentation, signing secret validation.
**Credentials:** `PAC_SLACK_BOT_TOKEN`, `PAC_SLACK_SIGNING_SECRET` — Netlify env vars only, never in code.
**Action ID convention:** `pac_<surface>_<action>` (see `naming-conventions.md`)
**Validation:** Every inbound Slack request must validate the signing secret before processing.
**Scopes:** Minimal. Document each scope and its justification in `docs/slack-scopes.md` (Phase 3).

---

## 5. Data / Audit / Security Governance

**Owner:** Engineering
**What it covers:** What is stored, where, who can read/write it, and what is logged.
**Audit log schema:** `governance/audit-log-schema.js`
**High Risk cases:** Must create an immutable audit entry on submission (Phase 3).
**PII policy:** Check content (scenario, answers, notes) is stored only in:
  - Browser localStorage (manager's own device)
  - Netlify Blobs under `pac/` namespace (Phase 3, when cross-surface state is added)
  - Email (when manager/HR explicitly sends it)
  - Nothing is stored on any server without an explicit user action.
**Default PIN:** The admin PIN default of `1234` is a known value. Force-change on first admin login is a Phase 3 security requirement.
**Auth gap:** `/api/save-hr-email` currently has no auth. Adding auth is a Phase 3 requirement.

---

## 6. Testing / Release Governance

**Owner:** Engineering
**Test requirement:** All PRs to `pac-enterprise-slack-build` must pass `npm test` before merge.
**Test layers:** Unit (Vitest), function integration (Vitest + mocks), E2E (Playwright, Phase 3).
**Release process:**
  1. Develop on `pac-enterprise-slack-build`
  2. Test on Netlify branch preview
  3. Merge to `webhooks` to deploy to production
**No direct commits to `webhooks`.** All changes via PR.

---

## 7. Operational Governance

**Owner:** Engineering
**Secrets inventory:**
  | Secret | Purpose | Location |
  |--------|---------|----------|
  | `BREVO_API_KEY` | Email sending | Netlify env var |
  | `BREVO_SENDER_EMAIL` | Email sender address | Netlify env var |
  | `NETLIFY_BLOBS_TOKEN` | Blobs read/write | Netlify env var |
  | `SITE_ID` | Blobs context | Netlify env var (auto-injected) |
  | `PAC_SLACK_BOT_TOKEN` | Slack API (Phase 3) | Netlify env var |
  | `PAC_SLACK_SIGNING_SECRET` | Slack request validation (Phase 3) | Netlify env var |

**Rotation:** Document rotation procedure in `DEPLOYMENT-NOTES.md` when each secret is added.
**Error monitoring:** Phase 3 — add Sentry or equivalent.
**Rate limiting:** Phase 3 — add rate limiting to all PAC Netlify Functions.
