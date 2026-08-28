# Deployment Notes — Netlify

## Status: verified working (2026-06-16)

Full flow tested end-to-end through the actual app UI (not just API calls): picked a scenario, answered all questions, reached the result screen, attached a file, generated the Word doc report, and sent via both "Email yourself" and "Send to HR" — emails arrived in the inbox with real attachments. Slack/Teams webhook relay tested separately and confirmed working. Nothing currently outstanding.

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

`BREVO_API_KEY` and `BREVO_SENDER_EMAIL` are set as Netlify environment variables (Site configuration → Environment variables). Set 2026-06-16.

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

## 2026-06-17: HR email moved from per-browser localStorage to a global setting

**Symptom:** An employee saw "HR email not configured yet" on the result screen's "Send to HR" panel, even though an admin had already set it in Company Policies → Upload Files.

**Root cause:** The HR email was only ever stored in the browser's `localStorage` (key `hr_check_hr_email_v1`) — there was no server-side/shared storage. Setting it on one browser/device never propagated to any other browser, device, or after clearing site data.

**Fix:**

- Added `netlify/functions/get-hr-email.js` and `netlify/functions/save-hr-email.js`, backed by **Netlify Blobs** (no external account needed, built into the Netlify site).
- Added `package.json` declaring `@netlify/blobs` as a dependency so Netlify installs it during the function build.
- `index.html` / `hr-action-check-final-5.26.html`: on load, the app now fetches the HR email from `/api/get-hr-email` (falling back to the cached localStorage value instantly while that request is in flight). The Company Policies "Save" button now POSTs to `/api/save-hr-email`, so the value is shared across every browser/device, not just the one that set it.

**Netlify Blobs gotcha:** Netlify's automatic Blobs context injection (zero-config `getStore("name")`) returned `MissingBlobsEnvironmentError` / "The environment has not been configured to use Netlify Blobs" in production on this site, despite working per Netlify's docs. Worked around it with explicit manual configuration in `netlify/functions/lib/blob-store.js`:

- `siteID` comes from `process.env.SITE_ID`, which Netlify auto-injects into every function — no setup needed.
- `token` comes from `process.env.NETLIFY_BLOBS_TOKEN`, a **Personal Access Token** that must be created manually (Netlify → User settings → Applications → Personal access tokens → New access token) and added as a site environment variable. **Scopes must include "Functions"** (or just select "All scopes") — the first attempt failed silently because the variable was saved without the right scope, so the function never saw it. Confirmed via a temporary debug field on the 500 response (since removed) showing `hasSiteId:true, hasToken:false`.
- This token is a third secret to keep alongside `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` — if it's ever revoked or rotated, `/api/get-hr-email` and `/api/save-hr-email` will start 500ing again with the same Blobs error.

**Verified:** `curl https://hractioncheck.netlify.app/api/get-hr-email` → `{"hrEmail":"<redacted>"}`. Save/load round-trip tested via curl before confirming through the actual UI.

## 2026-08-28 incident: policy uploads stored raw file bytes instead of text, and Netlify was deploying the wrong branch

**Symptom:** Uploading a PDF policy document (e.g. the employee handbook) under Company Policies stored raw, unparsed binary content (`%PDF-1.6 1844 0 obj <</Linearized...`) instead of extracted text. Fixes pushed to fix this appeared not to work at all, even after repeated "Trigger deploy" clicks in Netlify.

**Root cause #1 — code bug in `readFile()` (`src/web/App.jsx`, mirrored in `hr-action-check-final-5.26.html`):** PDF detection only matched `file.type === "application/pdf"` or a `.pdf` filename. Any PDF where the browser didn't set that MIME type, or where the filename didn't match, fell through to `reader.readAsText(file)` and stored the raw binary. There was also no handling at all for `.doc`/`.docx` uploads, despite the UI advertising Word support — Word files silently stored garbage the same way.

**Fix #1:** Added `isWordFile`/`isPdfFile`/`isTextish` helpers, a byte-sniffing fallback (checks for a `%PDF-` header) for files with ambiguous name/MIME type, and an explicit "can't be read automatically yet" message for Word docs instead of storing garbage. Verified via Playwright against a locally vendored copy of the app (PDF text now extracts correctly; `.docx` shows the explicit message instead of raw bytes); existing vitest suite still passes.

**Root cause #2 — Netlify was building from a stale branch:** The live site (pachr.netlify.app) deploys from `pac-enterprise-slack-build`, not `webhooks`. Earlier fixes were pushed/merged into `webhooks`, which auto-deploys to a different, unused Netlify site — so every push appeared to do nothing on the branch actually serving production, which was stuck at commit `b9bf299` (2026-07-10). Confirmed from the user's own Netlify Deploys-tab screenshot ("Production: pac-enterp... @b9bf299").

**Fix #2:** Copied the fixed `index.html` and `src/web/App.jsx` from commit `7a17bf2` onto a new branch off `origin/pac-enterprise-slack-build`, opened and merged PR #5 (merge commit `a7224071f250f8ccb3587f5651a70085730b5257`) directly into `pac-enterprise-slack-build` so Netlify's auto-deploy picks it up. `netlify/functions/pac-slack.js` was deliberately left untouched — it has diverged independently between `pac-enterprise-slack-build` and `webhooks`/this branch into two different Slack-integration implementations; reconciling that is unrelated to this bug and was out of scope.

**Also added (explicit user request, same investigation):** A "Remove" affordance reachable directly from the Company Policies → View Policies tab (`PolicyLibrary` in `src/web/App.jsx`) via an inline "Unlock to remove or edit" PIN prompt, so removing a bad document no longer requires switching to the Upload/Paste tab first.

**Lesson:** confirm which branch a Netlify site actually builds from (Site → Deploys, not assumptions from git history) before trusting that a merged fix is live. This repo currently has three branches with real, divergent history (`webhooks`, `pac-enterprise-slack-build`, `main`) — only `pac-enterprise-slack-build` is production for pachr.netlify.app as of this incident.

**Not yet done:** Reconcile `netlify/functions/pac-slack.js` between `pac-enterprise-slack-build` and `webhooks`/`main` — two different Slack-integration implementations currently coexist across branches.

## Verifying after future changes

1. `curl -sI https://hractioncheck.netlify.app/` — check the `etag` changed after a push, confirming a new deploy went out.
2. Load the page in a real browser and check the console for errors — a 200 response with correct byte count does **not** guarantee the page actually renders (this is exactly what happened in the blank-page incident above).
3. Test `/api/notify` end-to-end: `curl -X POST https://hractioncheck.netlify.app/api/notify -H "Content-Type: application/json" -d '{"webhookUrl":"https://httpbin.org/post","payload":{"text":"test"}}'` — should return `{"ok":true,"status":200}`.
4. Test `/api/send-report-email` end-to-end (after Brevo env vars are set): `curl -X POST https://hractioncheck.netlify.app/api/send-report-email -H "Content-Type: application/json" -d '{"to":"you@example.com","subject":"test","text":"test body"}'` — should return `{"ok":true}`. A `500` with "Email is not configured" means the Netlify env vars aren't set yet.
