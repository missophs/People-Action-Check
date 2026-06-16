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

## How notifications work (for reference)

- **Email yourself / email HR:** uses EmailJS (`emailjs.init()` with public key, service ID, template ID hardcoded near the top of the script — values match `project-notes.md`). No backend involved.
- **Slack / Teams ping:** user pastes an incoming webhook URL into Policy Library settings (stored in `localStorage`). On submit, the app POSTs a Slack Block Kit or Teams MessageCard payload to `/api/notify`, which relays it server-side to the saved webhook URL (browsers can't POST directly to Slack/Teams webhooks due to CORS, hence the relay function).

## Verifying after future changes

1. `curl -sI https://hractioncheck.netlify.app/` — check the `etag` changed after a push, confirming a new deploy went out.
2. Load the page in a real browser and check the console for errors — a 200 response with correct byte count does **not** guarantee the page actually renders (this is exactly what happened in the incident above).
3. Test `/api/notify` end-to-end: `curl -X POST https://hractioncheck.netlify.app/api/notify -H "Content-Type: application/json" -d '{"webhookUrl":"https://httpbin.org/post","payload":{"text":"test"}}'` — should return `{"ok":true,"status":200}`.
