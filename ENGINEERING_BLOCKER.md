# Engineering Blocker — Google Sign-In Revision Request

**Date:** 2026-09-03
**Author:** Senior Backend Integration Engineer
**Status:** Blocked — no governing SPEC.md

## What was requested

A revision to the Google Sign-In feature (commit `747f5b8`, already deployed):
1. Require Google sign-in before the risk-check tool is usable at all (move from optional to mandatory gate).
2. Auto-email check results to `identity.email` on the result step, no manual send.
3. Show Session History immediately on sign-in, no expand/collapse click.
4. Remove the old ephemeral in-page "Session history" block (`history`/`setHistory` state).

## Why this is blocked

This agent's contract is: implement exactly what `SPEC.md` describes (sourced from `ROOT_CAUSE.md`/`AUDIT.md`), and stop rather than guess if `SPEC.md` doesn't cover the request.

Checked repo state:
- `SPEC.md` in this repo (2026-07-08) covers a different, unrelated workstream: credential-exposure fix (CRIT-01), Slack ack-deadline hardening (HIGH-01/02), SSRF allowlist (MED-04), ESM/CJS unification (MED-02/03). It does not mention Google Sign-In, auto-email, or Session History.
- No `ROOT_CAUSE.md`, `AUDIT.md`, or `SPEC.md` exists anywhere in the repo for the Google Sign-In feature or this requested revision.
- The prior `IMPLEMENTATION_SUMMARY.md` (untracked, from this morning's run) explicitly scoped Google Sign-In as a separate, unreviewed-by-pipeline workstream and called the existing `SPEC.md` items out of scope for it — i.e. the two were already known to be unrelated.

This revision also:
- Changes an authentication/authorization gate (optional → mandatory sign-in), which is a user-facing access-control change.
- Adds new automatic outbound email behavior triggered on every completed check.
- Was accompanied by an instruction to push directly to `pac-enterprise-slack-build`, which auto-deploys to production (`pachr.netlify.app`), with no review artifact.

None of that is something this role is authorized to implement from an inline instruction alone — it requires a `SPEC.md` (or equivalent architect sign-off) describing the auth-gating change and the auto-email trigger specifically, the same way the original Google Sign-In feature should have gone through review before merge.

## What I did NOT do

- Did not modify `src/web/App.jsx`, `src/web/app-utils.js`, `src/web/app-data.js`, or `index.html`.
- Did not run `git add`/`git commit`/`git push`.
- Did not touch any file outside this blocker document.

## What would unblock this

A `SPEC.md` (or explicit architect-reviewed spec) covering:
- The exact auth-gating change (where in the render tree the gate moves, what happens to in-flight state if a user was mid-check when the gate was optional).
- The auto-email trigger point, retry/failure behavior, and whether it should be a one-time send per check or re-triggerable.
- Explicit confirmation that the old ephemeral `history` block has no remaining dependents (a grep-first check, not an assumption).

Once that exists, this role can implement it in one pass.
