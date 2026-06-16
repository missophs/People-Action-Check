# HR Sanity Check — Project Instructions

## What This Is

A standalone browser tool that helps managers run a structured risk check before taking HR action. No backend, no data storage. Everything runs in the browser.

## Live Deployment

- URL: https://hr-action-check.vercel.app
- Vercel project: `melissaw212-1631s-projects/hr-action-check`
- To redeploy: `vercel deploy --prod` from this folder

## Files

| File | Purpose |
|------|---------|
| `index.html` | Production file — what Vercel serves |
| `hr-action-check-final-5.26.html` | Most recent working version (source of truth) |
| `hr-sanity-check-artifact-final.jsx` | React source (reference only) |
| `HR-Sanity-Check-Project-2.md` | Full feature/version reference |
| `vercel.json` | Rewrites all routes to index.html |

## Workflow

1. Make changes to `hr-action-check-final-5.26.html`
2. Copy updated file to `index.html`
3. Run `vercel deploy --prod` to push live

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
