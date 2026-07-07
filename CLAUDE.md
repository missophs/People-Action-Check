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

## Engineering Workflow

## Engineering Workflow

### Primary Objective

Deliver complete, production-ready solutions while minimizing unnecessary iterations, repository rescans, and token usage.

Always understand the problem before modifying code.

---

### Investigation

Before making any code changes:

Read every file related to the requested feature.

Understand how the affected code interacts with the rest of the application.

Identify every related issue before editing.

Determine the root cause before implementing fixes.

If multiple issues originate from the same root cause, resolve them together.

Do not edit the first file that appears to contain an error until the surrounding workflow has been analyzed.

---

### Implementation

Fix root causes before downstream symptoms.

Batch related fixes into a single implementation whenever practical.

Continue investigating after the first successful fix to identify additional issues in the same workflow.

Preserve existing functionality unless a behavior change is explicitly requested.

Avoid unnecessary refactoring.

Avoid formatting-only edits.

Keep changes focused, reviewable, and consistent with the existing architecture.

Do not repeatedly rescan unchanged files unless new evidence indicates they are contributing to the problem.

---

### Validation

After all planned edits are complete:

Review every modified file.

Check for JavaScript runtime errors.

Check the browser console for errors or warnings.

Verify the complete user workflow affected by the change.

Verify LocalStorage behavior if affected.

Verify risk scoring logic if affected.

Verify report generation if affected.

Verify Brevo email delivery if affected.

Verify Slack notifications if affected.

Verify Microsoft Teams notifications if affected.

Verify Netlify Functions if affected.

Verify responsive behavior on desktop and mobile.

Confirm accessibility has not regressed.

Perform one consolidated validation after all planned work instead of validating after every individual edit whenever practical.

---

### Completion

Do not stop after the first successful fix if additional related issues are likely.

Continue until no significant issues remain within the requested scope.

Before completing the task, provide a concise summary including:

* Root cause
* Files modified
* Related issues resolved
* Remaining risks or limitations
* Recommended follow-up work, if any

Keep implementation updates concise.

Prioritize solving problems over explaining every intermediate step.

When multiple safe improvements are closely related to the requested work, complete them during the same implementation rather than creating unnecessary follow-up iterations.
