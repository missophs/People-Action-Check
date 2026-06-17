# HR Action Check

A private, browser-based confidence check for people-management decisions. Helps managers and HR think through risk before taking action on a workplace situation — performance issues, attendance, conflict, policy violations, terminations, accommodations, harassment/discrimination, retaliation concerns, RIFs, and leave of absence.

Live: [hractioncheck.netlify.app](https://hractioncheck.netlify.app)

Built by Melissa A. Weiss.

## How It Works

1. Pick the situation that matches what's happening
2. Answer a series of yes/no/don't-know questions (some marked critical)
3. Get a risk level (Low / Elevated / High) with recommended next steps
4. Optionally attach supporting files, download the check as a Word doc, email it to yourself, or send it directly to HR

## What This Is Not

- Not legal advice
- Not a decision engine — it's a structured prompt to think before acting

## Architecture

Everything runs client-side (React + Babel, no build step, no framework). Two small Netlify Functions exist purely as secure relays — there's still no database or stored user data on any server:

- `netlify/functions/notify.js` — relays Slack/Teams webhook notifications (browsers can't POST directly to those webhooks due to CORS)
- `netlify/functions/send-report-email.js` — sends email via Brevo's API (keeps the API key server-side, supports real file attachments)

Check history, saved policies, and settings persist only in the browser's `localStorage` — nothing is uploaded anywhere unless the user explicitly clicks "Email yourself" or "Send to HR."

## Features

- 10 scenario types, each with weighted yes/no/don't-know questions and a critical-question auto-escalation rule
- Per-question notes
- File attachments (images embed directly into the generated report; other file types are sent alongside as real email attachments)
- Auto-generated Word doc (`.docx`) report — downloadable or emailed
- Email yourself or send directly to HR (via Brevo, with real attachments)
- Slack / Teams incoming-webhook notifications when a check is sent to HR
- HR dashboard for reviewing submitted checks
- Company policy library, scoped per scenario
- 30-day follow-up reminders
- Session auto-save/resume

## Files

| File | Purpose |
|------|---------|
| `index.html` | Production file — what Netlify serves |
| `hr-action-check-final-5.26.html` | Source-of-truth working copy, kept in sync with `index.html` |
| `netlify.toml` | Publish dir, SPA redirect, `/api/*` → Netlify Functions routing |
| `netlify/functions/notify.js` | Slack/Teams webhook relay |
| `netlify/functions/send-report-email.js` | Brevo-backed email sending with attachments |
| `api/notify.js`, `vercel.json` | Legacy Vercel deployment support (kept for parity, not actively used) |
| `DEPLOYMENT-NOTES.md` | Incident history and deployment/config reference |
| `CLAUDE.md` | Project instructions for AI-assisted development |

## Running Locally

No build process. Just open `index.html` in a browser — though the "Send to HR" / "Email yourself" buttons won't work locally since they call Netlify Functions that only exist on the deployed site.

```bash
git clone https://github.com/missophs/hr-action-check.git
cd hr-action-check
git checkout webhooks
open index.html
```

## Deploying

Push to the `webhooks` branch (GitHub default branch) — Netlify auto-publishes from there. See `DEPLOYMENT-NOTES.md` for environment variable setup (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`) and troubleshooting history.

---

*General guidance only. Not legal advice.*
