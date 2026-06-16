# HR Action Check — Project Reference

## Live URL
https://hr-action-check.vercel.app

## Vercel Project
melissaw212-1631s-projects/hr-action-check

## Source Files (this folder)
- `hr-action-check-final-5.26.html` — **edit this file for all changes**
- `index.html` — deployed entry point, must stay in sync with above
- `vercel.json` — Vercel config

## To Deploy
1. Edit `hr-action-check-final-5.26.html`
2. `cp hr-action-check-final-5.26.html index.html`
3. `vercel deploy --prod`

---

## What It Does
10 HR scenarios with weighted risk scoring. Employees complete a check, email results to themselves, add their own notes, and bring it to HR. PIN-gated policy library for HR to upload company documents. Works on phone, tablet, and desktop. No install required.

---

## Scenarios Covered

| Scenario | Risk Level |
| :--- | :--- |
| Performance Decline | Moderate |
| Attendance Issue | Moderate |
| Interpersonal Conflict | Moderate |
| Policy Violation | Moderate |
| Termination Consideration | High |
| Accommodation Request | High |
| Harassment / Discrimination | High |
| Retaliation Concern | High |
| Reduction in Force | High |
| Leave of Absence | Moderate |

---

## Features (current)

- **Scenario context panel** — description, examples, legal watch-outs, documentation tips
- **Expandable hints** — "Why this matters" toggle per question
- **Critical question flags** — No or Don't Know auto-escalates to High Risk
- **Weighted scoring** — critical questions carry 2x weight; Don't Know = 0.75x
- **Live risk indicator** — updates after each answer
- **Progress bar** — shows completion percentage
- **Score breakdown** — visual bar chart of Yes / No / Don't Know
- **Scenario-specific next steps** — 3 actionable steps per result level
- **Notes field** — optional per-question context included in email
- **Copy summary** — copies full check to clipboard
- **Session auto-save** — in-progress check survives browser close
- **Session History** — last 10 completed checks saved to localStorage; collapsible box on home screen; tap any entry to view full Q&A + next steps; individual delete (×) and clear all
- **Email to self** — EmailJS sends full results to employee's inbox; employee adds notes and forwards to HR; "Start a new check" button resets after send
- **PIN-gated policy library** — HR uploads/pastes company documents (handbook, policies); employees can view; default PIN 1234
- **PWA support** — installable on iPhone/Android home screen
- **Mobile responsive** — 44px touch targets, 16px inputs (no iOS zoom), responsive header

---

## EmailJS Integration

| Field | Value |
| :--- | :--- |
| Public Key | 80my-FS9g6L7AcdHa |
| Service ID | service_b8k1nic |
| Template ID | template_7gsihiw |
| Template variables | `{{to_email}}`, `{{subject}}`, `{{message}}` |
| Free tier limit | 200 emails/month (resets monthly) |

---

## Scoring Logic

| Condition | Result |
| :--- | :--- |
| Any critical question = No or Don't Know | High Risk (regardless of total) |
| Weighted ratio ≤ 15% | Low Risk |
| Weighted ratio 16–45% | Elevated Risk |
| Weighted ratio > 45% | High Risk |

- Critical questions: weight = 2
- Standard questions: weight = 1
- "Don't know" counts as 0.75 × question weight

---

## localStorage Keys

| Key | Contents |
| :--- | :--- |
| hr_check_session_v3 | Current in-progress session |
| hr_check_history_v1 | Last 10 completed checks |
| hr_check_policies_v3 | Uploaded company policy documents |
| hr_check_pin_v3 | Hashed HR admin PIN |

---

## Ownership
© 2025 Melissa A. Weiss. All rights reserved.
General guidance only — not legal advice.
