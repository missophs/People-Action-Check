# PAC — Ownership Map

| Area | Owner | Change Process |
|------|-------|---------------|
| Scenario content (questions, weights, hints, next steps) | Product | PR to pac-enterprise-slack-build |
| Scoring logic + risk thresholds | Engineering | PR with test coverage |
| Workflow state machine | Product + Engineering | PR with updated state diagram |
| Design tokens | Engineering | PR — update web + Slack simultaneously |
| Slack action ID naming | Engineering | Follow naming-conventions.md |
| Netlify Functions | Engineering | PR — do not deploy untested functions |
| Admin-configurable settings | Admin (pin-gated) | In-app settings UI |
| Secrets / env vars | Engineering | Netlify dashboard — document in DEPLOYMENT-NOTES.md |
| Governance docs (this folder) | Product + Engineering | PR — both must review |
