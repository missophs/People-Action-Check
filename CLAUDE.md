# HR Action Check — Project Instructions

## What This Is

A standalone browser tool that helps managers run a structured risk check before taking HR action. No database, no stored user data on any server — check history and settings live in the browser's `localStorage`. Two small Netlify Functions exist only as secure relays (Slack/Teams webhook posting, Brevo email sending) since browsers can't do those directly.

## Live Deployment

- URL: https://hractioncheck.netlify.app (primary — auto-deploys from GitHub)
- Deploys from: `github.com/missophs/hr-action-check`, branch `webhooks` (GitHub default branch)
- Auto-publish is on — just `git push origin webhooks` to deploy
- Secondary/backup: https://hr-action-check.vercel.app (Vercel project `melissaw212-1631s-projects/hr-action-check`, not actively used — kept connected for parity, see `DEPLOYMENT-NOTES.md`)
- See `DEPLOYMENT-NOTES.md` for required Netlify environment variables (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`) and incident/troubleshooting history

## Files

| File | Purpose |
|------|---------|
| `index.html` | Production file — what Netlify serves |
| `hr-action-check-final-5.26.html` | Source-of-truth working copy, kept identical to `index.html` |
| `hr-sanity-check-artifact-final.jsx` | React source (reference only) |
| `HR-Sanity-Check-Project-2.md` | Full feature/version reference |
| `netlify.toml` | Publish dir, SPA redirect, `/api/*` routing to Netlify Functions |
| `netlify/functions/notify.js` | Slack/Teams webhook relay |
| `netlify/functions/send-report-email.js` | Brevo-backed email sending (supports real attachments) |
| `vercel.json`, `api/notify.js` | Legacy Vercel support, not actively used |
| `DEPLOYMENT-NOTES.md` | Deployment config, env vars, incident history |

## Workflow

1. Make changes to `hr-action-check-final-5.26.html`
2. Copy updated file to `index.html` (`cp hr-action-check-final-5.26.html index.html`)
3. Commit and `git push origin webhooks` — Netlify auto-deploys
4. Verify: check the `etag` changed on the live URL, and load the page in a real browser (a 200 response doesn't guarantee it actually renders — see `DEPLOYMENT-NOTES.md`)

## Scenarios Covered

Performance Decline, Attendance Issue, Interpersonal Conflict, Policy Violation, Termination Consideration, Accommodation Request, Harassment/Discrimination, Retaliation Concern, Reduction in Force, Leave of Absence.

## Scoring Logic

- Critical question answered No or Don't Know → High Risk (auto-escalates)
- Weighted ratio ≤ 15% → Low Risk
- Weighted ratio 16–45% → Elevated Risk
- Weighted ratio > 45% → High Risk
- Critical questions: weight 2, Standard: weight 1, Don't Know: 0.75x weight

## Writing Preferences

Direct, no filler. Active voice. Short sentences. No em dashes.
