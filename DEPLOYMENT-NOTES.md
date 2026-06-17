# Deployment Notes — Netlify

## Current setup

- Live site: https://hractioncheck.netlify.app
- Deploys from: `github.com/missophs/hr-action-check`, branch `webhooks` (GitHub default branch)
- Auto-publish: on — every push to `webhooks` triggers a Netlify rebuild automatically
- Vercel (`hr-action-check.vercel.app`) still exists and still works as a secondary/backup deployment, but Netlify is the one in active use.

## 2026-06-16 incident: site went blank

**Symptom:** Page loaded (HTTP 200, correct HTML) but showed a blank screen — nothing rendered.

**Root cause:** `index.html` loaded Babel's in-browser JSX transformer from an **unversioned** CDN URL:
```
https://unpkg.com/@babel/standalone/babel.min.js
```
Babel published a new major version (v8.0.0), and unpkg started resolving the unpinned URL to it. v8 has different defaults and threw `SyntaxError: Cannot use import statement outside a module` while transforming the page's inline JSX, which crashed the script before React ever called `root.render()`. Nothing on the page — including EmailJS init and the Slack/Teams notify logic — ever ran.

**Fix:** pinned the script tag to a major version:
```
https://unpkg.com/@babel/standalone@7/babel.min.js
```
Applied in both `index.html` (deployed file) and `hr-action-check-final-5.26.html` (source-of-truth file per the edit workflow), so the next copy-to-`index.html` cycle won't reintroduce the bug. Commit `710701f`.

**Lesson:** any CDN `<script src="https://unpkg.com/...">` tag without a version number is a future outage waiting to happen. The other three (`react@18`, `react-dom@18`, `@emailjs/browser@3`) are already pinned to majors — only Babel was loose. If new CDN scripts are added later, pin them too.

## Same incident, separate issue: Netlify-specific fix

Independent of the blank-page bug, the webhook-notify feature (`/api/notify`, used for Slack/Teams pings) needed Netlify-specific plumbing:

- `index.html` calls `fetch("/api/notify", ...)`.
- The original `api/notify.js` was written in **Vercel's** serverless function convention (`(req, res)` handler), which Netlify doesn't run.
- Added `netlify.toml` (publish dir, SPA redirect, routes `/api/*` → `/.netlify/functions/:splat`) and `netlify/functions/notify.js` (same logic, rewritten as a Netlify Function — `exports.handler = async (event) => {...}` returning `{statusCode, headers, body}`).
- `api/notify.js` and `vercel.json` were left untouched so Vercel still works if used again.
- Commit `1be0d16`.

## Brevo configuration status

`BREVO_API_KEY` and `BREVO_SENDER_EMAIL` (sender: `melissaw212@gmail.com`) are set as Netlify environment variables (Site configuration → Environment variables). Set 2026-06-16.

## How notifications work (for reference)

- **Slack / Teams ping:** user pastes an incoming webhook URL into Policy Library settings (stored in `localStorage`). On submit, the app POSTs a Slack Block Kit or Teams MessageCard payload to `/api/notify`, which relays it server-side to the saved webhook URL (browsers can't POST directly to Slack/Teams webhooks due to CORS, hence the relay function). Unaffected by the email changes below.

## 2026-06-16/17: replaced EmailJS with Brevo, added file attachments + Word doc report

**Why:** EmailJS's free tier silently used generic boilerplate template text instead of the actual check content (the `{{message}}` variable was never wired into the EmailJS dashboard template), and EmailJS's free tier doesn't support real file attachments at all. HR needs the actual check answers, notes, and any supporting files (screenshots, documents) to land directly in the email.

**What changed:**
- Removed EmailJS entirely (script tag, init, `emailjs.send()` calls). No EmailJS dashboard template to maintain anymore.
- Added the `docx` library (`https://unpkg.com/docx@8.6.0/build/index.umd.js`) to generate a real `.docx` report client-side — title, scenario, every question/answer/note, next steps, and any attached **images embedded directly** in the document.
- Added a "Download report (.docx)" button on the result screen (uses `Packer.toBlob`).
- Added an "Attach supporting files" section on the result screen — employee can attach any files (File API, in-browser only, nothing uploaded until send). Guidance text suggests consolidating emails/Slack/Teams content into one Word doc first, since the browser can't merge two `.docx` files into one.
- Added `netlify/functions/send-report-email.js` — calls **Brevo's** transactional email API (`https://api.brevo.com/v3/smtp/email`) server-side (API key never exposed to the browser). Both "Email this to yourself" and "Send to HR" now POST to `/api/send-report-email` with `{ to, subject, text, attachments: [{filename, base64Content}] }`. The generated `.docx` report plus every file the employee attached are sent as **real email attachments** — not just embedded text.
- Requires two Netlify environment variables (Site settings → Environment variables, not in code):
  - `BREVO_API_KEY` — from Brevo dashboard → SMTP & API → API Keys
  - `BREVO_SENDER_EMAIL` — the email address verified as a sender in Brevo (Senders, Domains & Dedicated IPs → Senders)
  - Until both are set, `/api/send-report-email` returns a clear 500 ("Email is not configured...") instead of silently failing — `sendEmail`/`sendToHR` catch this and show the existing "Something went wrong" error state in the UI.
- Brevo free tier: 300 emails/day, no domain purchase required, just sender-email verification.

## Verifying after future changes

1. `curl -sI https://hractioncheck.netlify.app/` — check the `etag` changed after a push, confirming a new deploy went out.
2. Load the page in a real browser and check the console for errors — a 200 response with correct byte count does **not** guarantee the page actually renders (this is exactly what happened in the blank-page incident above).
3. Test `/api/notify` end-to-end: `curl -X POST https://hractioncheck.netlify.app/api/notify -H "Content-Type: application/json" -d '{"webhookUrl":"https://httpbin.org/post","payload":{"text":"test"}}'` — should return `{"ok":true,"status":200}`.
4. Test `/api/send-report-email` end-to-end (after Brevo env vars are set): `curl -X POST https://hractioncheck.netlify.app/api/send-report-email -H "Content-Type: application/json" -d '{"to":"you@example.com","subject":"test","text":"test body"}'` — should return `{"ok":true}`. A `500` with "Email is not configured" means the Netlify env vars aren't set yet.
