# People Action Check (PAC) — Project Instructions

## What This Is

PAC is an enterprise HR risk-check tool with a Slack-first interface (Block Kit) plus a web app.
It is a **separate product** from HR Action Check (`hractioncheck.netlify.app` — never touch that one).

## Live Deployment

- URL: https://pachr.netlify.app — auto-deploys from this repo, branch `pac-enterprise-slack-build`
- Repo: `github.com/missophs/People-Action-Check`
- Case data: Netlify Blobs, store `pac-cases`, blob key `case/<managerId>/<caseId>` (see `netlify/functions/lib/stores/`)

## Structure

| Path | Purpose |
|------|---------|
| `src/core/` | scenarios, scoring, workflow, report — pure logic |
| `src/web/` | `App.jsx` + data/utils — the web app; `index.html` is a thin shell |
| `src/design-system/` | tokens (css + js), components — no hardcoded hex outside this |
| `src/services/` | client-side fetch wrappers (cases, email, notify) |
| `src/slack/` | Slack-side actions/builders (in progress) |
| `netlify/functions/pac-slack.js` | Main Slack request dispatcher — slash command, block_actions, view_submission, events |
| `netlify/functions/lib/` | shared libs: blob-store, data-store, email-notify, export-token, governance, pac-blocks, pac-data, scoring |
| `netlify/functions/case-store.js`, `save-hr-email.js`, `export-cases.js`, `get-hr-email.js`, `notify.js` | individual function endpoints |
| `governance/` | design-system governance, naming conventions, ownership docs |
| `tests/` | vitest — core, slack, design-system, services, regression |

## Workflow

- `npm test` (vitest run) before considering any change done
- `npm run build:cjs` — required build bridge step (ESM/CJS), wired into `netlify.toml` build command
- `PAC_ADMIN_TOKEN` required on all `save-hr-email` writes (missing → 503, wrong → 401)

## Engineering Process

For non-trivial bugs or features, use the specialist subagents in `.claude/agents/` (incident-manager,
slack-platform-engineer, quality-engineer, software-architect, backend-integration-engineer,
verification-engineer, principal-engineer) instead of debugging inline. Each stage produces its
artifact (ROOT_CAUSE.md, AUDIT.md, SPEC.md, IMPLEMENTATION_SUMMARY.md, VERIFY.md, REVIEW.md) in
isolation and hands only that artifact to the next stage — this keeps each stage's raw investigation
(repo greps, test runs, build output) out of the main conversation. Reserve the full pipeline for
real/recurring defects; a one-line fix with an obvious cause doesn't need all 7 stages.

## Writing Preferences

Direct, no filler. Active voice. Short sentences. No em dashes.
