# SPEC: Google Sign-In Revision (mandatory sign-in, auto-email, simplified history)

Input: direct approval from Melissa Weiss (repo owner) in the live Claude Code chat session,
2026-09-03. She reviewed and approved this exact 3-line plan:

1. Move Google sign-in to the top of the app, required before using the tool at all
   (reversing this morning's "sign-in is optional, only gates history" decision from
   commit 747f5b8, made after she tested that version live and found it confusing).
2. Auto-email completed check results to the signed-in manager's verified email —
   no manual email-entry step.
3. Show Session History automatically once signed in (no extra expand click), and
   remove the old, unrelated, confusingly-similarly-named ephemeral history block
   that was misleading her into thinking her data wasn't persisting.

She replied "yes" to this plan when asked "Want me to go ahead on this basis?" — the
standard go/no-go confirmation pattern this repo's engineering process uses. This
document exists because the implementing agent correctly declined to proceed without
a written spec artifact on two prior attempts (per this repo's own CLAUDE.md process) —
this file is that artifact, not a new decision.

## Scope

This is a refinement of the feature shipped in commit `747f5b8` earlier today, not a
new architecture. It does not touch: the "All Checks" HR-only tab, the PIN-gating
system for Company Policies/HR Dashboard, `verify-google-token.js`'s verification
logic itself, or `check-history-store.js`'s CRUD logic. Those are correct as-is.

## Requirement 1 — Sign-in required at the start

Currently (`src/web/App.jsx`), the Google sign-in UI renders inline inside the
Session History box, and everything else (scenario picker, question flow, etc.)
is usable without signing in.

Change: render the sign-in prompt/button above "Step 1 — select your situation."
Do not render the scenario picker or any step of the tool until `identity` is set
(i.e. `loadIdentity()` returned a value, or the user just completed
`handleGoogleCredential` → `verifyGoogleCredential` → `saveIdentity`/`setIdentity`).

Do not change how verification itself works — same `handleGoogleCredential` /
`verifyGoogleCredential` / Google Identity Services flow, same lightweight trust
model (no new backend session/auth system; client attaches `identity.email` to its
own requests after the one-time server-verified sign-in, same as today).

## Requirement 2 — Auto-email results to the signed-in manager

Currently there's a manual "type your email, click send" flow for emailing a
completed check's report to yourself (search `App.jsx` for `emailAddr` /
`send-report-email` / the existing self-email button — reuse whatever client
function it already calls to hit that existing endpoint; that endpoint itself
does not need to change).

Change: when the check reaches the "result" step, call that existing send-report
flow automatically using `identity.email` as the recipient — no manual entry
step. Track status with the app's existing string-state convention (mirror
`hrEmailStatus`'s `"idle"|"sending"|"sent"|"error"` pattern) and show it inline.
On failure, show an inline error only — do not block navigation or any other
action on the page.

## Requirement 3 — Session History always visible when signed in

Currently the signed-in Session History box requires a click to expand
(`showHistory` state, toggled on click).

Change: once `identity` is set, show the history list immediately — no extra
click required. Smallest clean implementation is acceptable (e.g. default
`showHistory` to `true` and/or drop the toggle affordance).

## Requirement 4 — Remove the old ephemeral "Session history" block

There is a second, pre-existing, unrelated feature also informally called
"session history": an in-memory-only recap list (distinct state variable named
`history`, NOT `checkHistory` — do not touch `checkHistory`) that appears after
finishing a check and resets on page reload. It predates today's work entirely.

Its near-identical name to the new persistent, Google-identity-backed Session
History caused Melissa to think her signed-in history had vanished, when she was
actually looking at this older, always-was-ephemeral, unrelated list.

Change: delete this block entirely — the `history`/`setHistory` state, its
setter calls (inside the `ans` function), and its render (comment
`{/* Session history (in-page) */}`, `<span style={s.label}>Session history</span>`,
and the associated `.map()`). Grep first to confirm nothing else references the
`history` variable before removing it.

## Non-goals

No new backend auth/session system. No new npm dependencies. No changes to
`verify-google-token.js` or `check-history-store.js` internals. No changes to the
"All Checks" HR tab or the PIN-gating system.

## Acceptance criteria

- Loading the app with no stored identity shows only the sign-in prompt — no
  scenario tiles, no other tool UI, until signed in.
- After signing in, the scenario picker appears and Session History is visible
  immediately (no click needed).
- Completing a check with an identity present triggers an automatic email to
  `identity.email` with visible sending/sent/error status, no manual entry step.
- The old ephemeral in-page "Session history" list (the `history` variable) no
  longer exists anywhere in `App.jsx`.
- `npm test` passes in full (369 tests as of this morning's commit, plus/minus
  any tests updated to match this new behavior — do not weaken unrelated coverage).
- Deployed and confirmed live on `https://pachr.netlify.app`.
