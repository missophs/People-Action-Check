# Handoff notes — pick up here next session

Last updated: 2026-09-03, by Claude Code session.

## What's done and live

Both features below are merged into `pac-enterprise-slack-build` (commit `a4b2e7c`) and
deployed to **https://peopleactioncheck.netlify.app** — this is the one true source.
`pachr.netlify.app` was intentionally disabled.

1. **Multi-scenario selection.** On the scenario-pick screen, cards now toggle on/off
   instead of jumping straight to the next step. Pick one or more, then hit "Continue."
   Questions from every picked scenario get combined into one check, one score, one
   result screen (grouped by scenario where it matters — next steps, contact-HR lines,
   policy docs). All in `src/web/App.jsx`.
2. **Manual send button.** Signing in with Google no longer auto-emails HR. There's one
   "Send to me and HR" button on the result screen that fires both copies (your copy +
   HR's copy) together, with separate status/retry per leg if one fails.

Where the data lives: check history, HR submissions, HR email address, and policy docs
are all stored server-side in Netlify Blobs (via Netlify Functions), not just the
browser — so it's not lost if someone clears their browser or switches devices.
Still browser-only (not yet synced): PIN, Slack/Teams webhook URLs, 30-day follow-up
reminders. Not touched this session, flagged for later if it matters.

## Fixed — 2026-09-04

**Google Sign-In "Error 400: origin_mismatch" is resolved.** The OAuth client
("PAC Web") now has both `https://pachr.netlify.app` and
`https://peopleactioncheck.netlify.app` under Authorized JavaScript origins, saved
and confirmed working. Login on the live site works.

## Open — needs a look, not yet diagnosed

**"Blue writing is hard to read."** The screenshot the user sent was Google's own
"Access blocked" error page (accounts.google.com) — that page's blue link text is
Google's, not ours, and will disappear once the origin_mismatch fix above goes in.
Still unconfirmed whether the user was also pointing at something in our own app
(e.g. a low-contrast blue link/button somewhere in `App.jsx` or
`src/design-system/tokens.css`). Ask for a fresh screenshot of the actual app (after
login works) if the complaint persists, and check contrast on any blue text there.
