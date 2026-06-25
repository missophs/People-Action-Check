# People Action Check — Session Summary

## What PAC Is

Enterprise HR risk-check tool. Separate product from HR Action Check (cloned from it).

- **Repo:** `github.com/missophs/People-Action-Check`
- **Branch:** `pac-enterprise-slack-build`
- **Working directory:** `/Users/Owner/Desktop/People Action Check`
- **Latest commit:** `8836fb6`

> **HR Action Check (`hractioncheck.netlify.app`) is completely off-limits. Never touch it.**

---

## What Was Built (Phases 0–2)

### Phase 0 — Safety Setup
- Created and pushed `pac-enterprise-slack-build` branch
- Fixed remote URL (was incorrectly pointing at HR Action Check repo)

### Phase 1 — Audit (No Code)
10-item audit: repo assessment, coupling, architecture, Slack Block Kit surface map, workflow/state model, governance, testing strategy, implementation plan, first files to touch, risks.

### Phase 2 — Architecture Scaffold

| File / Dir | What it is |
|---|---|
| `src/core/scenarios.js` | Canonical scenario data (10 scenarios, 5 questions each, next steps) |
| `src/core/scoring.js` | Risk calculation engine |
| `src/core/workflow.js` | Case state machine (NOT_STARTED → ARCHIVED) |
| `src/core/report.js` | Text summary + email subject helpers |
| `src/services/storage.js` | localStorage abstraction + server sync |
| `src/services/notify.js` | Slack/Teams payload builders + relay |
| `src/services/email.js` | Brevo email relay wrapper |
| `src/config/governance.config.js` | Admin-configurable vs code-controlled boundary |
| `src/config/defaults.js` | Default values, risk level labels/colors |
| `src/slack/`, `src/web/` | Scaffolds (Phase 3) |
| `governance/` | GOVERNANCE.md, naming conventions, audit log schema, ownership |
| `tests/` | 39 unit tests — all passing |
| `docs/ARCHITECTURE.md` | Current state + Phase 3 target |

### Phase 2 Security Fixes
- Vitest upgraded to v4.1.9 — 0 npm vulnerabilities
- `netlify/functions/save-hr-email.js` — optional `PAC_ADMIN_TOKEN` auth added
- `index.html` — default PIN "1234" now forces change-PIN flow instead of granting access
- `index.html` — drift comments added pointing to `src/core/` canonical sources

---

## Scoring Logic

| Condition | Result |
|---|---|
| Critical question answered No or Don't Know | High Risk (auto-escalates) |
| Weighted ratio ≤ 15% | Low Risk |
| Weighted ratio 16–45% | Elevated Risk |
| Weighted ratio > 45% | High Risk |

- Critical questions: weight 2
- Standard questions: weight 1
- Don't Know: 0.75× weight multiplier

---

## Key Constraints

- `index.html` is not modified until Phase 3 — the live app must remain working
- All new Netlify Functions are prefixed `pac-` to avoid routing conflicts
- `src/core/` has zero UI dependencies — safe to import from functions and the web layer
- All Slack secrets are env vars only: `PAC_SLACK_BOT_TOKEN`, `PAC_SLACK_SIGNING_SECRET`
- Netlify Blobs requires manual config (auto-injection fails in production) — use pattern in `netlify/functions/lib/blob-store.js`

---

## Environment Variables (Netlify — never put in code)

| Var | Purpose |
|---|---|
| `PAC_SLACK_BOT_TOKEN` | Slack bot token |
| `PAC_SLACK_SIGNING_SECRET` | Slack signing secret |
| `PAC_ADMIN_TOKEN` | Optional write auth for save-hr-email |
| `BREVO_API_KEY` | Email sending |
| `BREVO_SENDER_EMAIL` | Email sending |
| `NETLIFY_BLOBS_TOKEN` | Blobs access |
| `SITE_ID` | Blobs site identifier |

---

## Case State Machine

```
NOT_STARTED
  → IN_PROGRESS_WEB / IN_PROGRESS_SLACK
  → SUBMITTED
  → ACKNOWLEDGED
  → UNDER_REVIEW / ESCALATED
  → CLOSED
  → ARCHIVED
```

---

## What's Next — Phase 3 (Not Started, Needs Go-Ahead)

- Vite build pipeline
- React components extracted from `index.html` to `src/web/`
- Slack plugin built in `src/slack/` + `netlify/functions/pac-*.js`
- Cross-surface case state in Netlify Blobs
- Immutable audit log for High Risk cases
- Auth on write endpoints, rate limiting, error monitoring
