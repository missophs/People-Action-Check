# People Action Check — Architecture

## Current State (Phase 2)

The core business logic has been extracted into maintainable modules. The web app still runs from `index.html` (unchanged). The Slack plugin is scaffolded but not yet built.

```
index.html                   ← web app (unchanged, still running)
src/
  core/
    scenarios.js             ← scenario data, questions, next steps (extracted)
    scoring.js               ← risk calculation engine (extracted)
    workflow.js              ← case state machine (new)
    report.js                ← text summary + email subject helpers (extracted)
  services/
    storage.js               ← localStorage abstraction + server-sync helpers
    notify.js                ← Slack/Teams notification payload builders + relay
    email.js                 ← Brevo email relay wrapper
  config/
    governance.config.js     ← admin-configurable vs code-controlled boundary
    defaults.js              ← default values, risk level labels + colors
  slack/
    index.js                 ← Slack plugin scaffold (Phase 3)
    actions/                 ← Slack action handlers (Phase 3)
    builders/                ← Block Kit modal/message builders (Phase 3)
  web/
    index.js                 ← web component scaffold (Phase 3)
governance/
  GOVERNANCE.md              ← seven governance domains
  naming-conventions.md      ← Slack action IDs, file naming, Blobs namespaces
  audit-log-schema.js        ← case audit entry schema
  ownership.md               ← who owns what, change process
tests/
  core/
    scoring.test.js          ← risk scoring unit tests
    scenarios.test.js        ← scenario data schema validation tests
    workflow.test.js         ← state machine unit tests
  fixtures/
    scenarios.fixture.js     ← shared question/answer test data
    submissions.fixture.js   ← shared case/submission test data
netlify/functions/           ← existing functions (unchanged)
  notify.js
  send-report-email.js
  get-hr-email.js
  save-hr-email.js
  lib/blob-store.js
```

## Phase 3 Target

- Vite build pipeline
- React components extracted from `index.html` to `src/web/`
- Slack plugin built in `src/slack/` with Netlify Functions in `netlify/functions/pac-*.js`
- Cross-surface case state in Netlify Blobs
- Immutable audit log for High Risk cases

## Key Constraints

- `index.html` is not modified until Phase 3 — the live app must remain working throughout
- All new Netlify Functions are prefixed `pac-` to avoid routing conflicts
- `src/core/` has zero UI dependencies — safe to import from functions and the web layer
- All Slack secrets are env vars only: `PAC_SLACK_BOT_TOKEN`, `PAC_SLACK_SIGNING_SECRET`
