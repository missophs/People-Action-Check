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

## Open — blocks login right now

**Google Sign-In fails: "Error 400: origin_mismatch."**

Cause: the OAuth client's Authorized JavaScript origins list only has
`https://pachr.netlify.app` (the site that got disabled). It's missing
`https://peopleactioncheck.netlify.app`, so Google refuses the login on the live site.

Fix (in Google Cloud Console, not a code change):
1. console.cloud.google.com → make sure the "People Action Check" project is selected
2. Search bar at top → type `Credentials` → click **Credentials** under APIs & Services
3. Under "OAuth 2.0 Client IDs," click **PAC Web**
4. Under **Authorized JavaScript origins**, click **+ Add URI**
5. Type `https://peopleactioncheck.netlify.app` in the new box (leave the existing
   `pachr.netlify.app` line alone)
6. Scroll down, click **Save**
7. Wait ~5 minutes, then reload the site and try signing in again

We got as far as being on the "PAC Web" client's Authorized JavaScript origins page,
about to click "+ Add URI," when the session ended for the night. This is the very
next click to make.

## Open — needs a look, not yet diagnosed

**"Blue writing is hard to read."** The screenshot the user sent was Google's own
"Access blocked" error page (accounts.google.com) — that page's blue link text is
Google's, not ours, and will disappear once the origin_mismatch fix above goes in.
Still unconfirmed whether the user was also pointing at something in our own app
(e.g. a low-contrast blue link/button somewhere in `App.jsx` or
`src/design-system/tokens.css`). Ask for a fresh screenshot of the actual app (after
login works) if the complaint persists, and check contrast on any blue text there.
