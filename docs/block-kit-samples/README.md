# Block Kit samples

Real Block Kit JSON generated from `netlify/functions/lib/pac-blocks.js` and
`netlify/functions/lib/governance.js` — not hand-written. Regenerate any time
the block builders change by re-running the script in the PR/commit that
added this folder (calls each builder function directly with sample data).

## Files

| File | Slack surface type | Where it appears |
|------|--------------------|--------------------|
| `01-slash-response.json` | Message (ephemeral) | After a manager runs `/pac` |
| `02-intake-modal.json` | Modal | "Start New Check" |
| `03-questions-modal.json` | Modal | After intake — Performance Decline, 5 questions |
| `04-result-dm-low.json` | Message | Manager DM — Low Risk result |
| `05-result-dm-high.json` | Message | Manager DM — High Risk result |
| `06-hr-triage.json` | Message | Posted to `#hr-team` |
| `07-app-home.json` | App Home view | Manager's PAC dashboard tab |
| `08-export-modal.json` | Modal | "Export" (HR view) |
| `09-upload-doc-modal.json` | Modal | "Upload Documentation" |

## Using these in Slack's Block Kit Builder

**You do not need to pick a template.** The "Templates" tab in Block Kit
Builder is Slack's own example gallery (Approvals, polls, etc.) — generic
starting points for people building an app from scratch. PAC's design isn't
built from any of those; it's generated entirely from this repo's own block
builder code, so picking a template would replace it, not extend it. Skip
Templates and go straight to **Builder**.

1. Go to https://app.slack.com/block-kit-builder and log into your workspace.
2. Click the **Builder** tab (not Templates) at the top.
3. Near the top of the builder there's a surface-type selector — set it to
   match the file: **Message** for `01`, `04`, `05`, `06`; **Modal** for
   `02`, `03`, `08`, `09`; **App Home** for `07`.
4. Select all the JSON in the left-hand editor pane and delete it.
5. Open the sample file, copy its full contents, and paste into the editor.
   - For `04`, `05`, `06` (the ones with a colored left border): those files
     have a top-level `attachments` array — that's Slack's legacy
     attachments API, which is how the colored risk border is drawn. Block
     Kit Builder's live preview only renders the top-level `blocks` array
     for messages, so the color bar won't show in Builder — paste
     `attachments[0].blocks` directly (just that inner blocks array) if you
     want to preview the message content in Builder. The color bar itself
     only renders in real Slack, since it's outside Block Kit proper.
6. The right-hand pane updates live — this is Slack's own renderer, so it's
   pixel-exact, unlike the approximated HTML preview.

## Regenerating

```js
const B = require('../../netlify/functions/lib/pac-blocks');
const G = require('../../netlify/functions/lib/governance');
const { SCENARIO_QUESTIONS } = require('../../netlify/functions/lib/pac-data');
// call B.slashResponseBlocks(), B.intakeModal(), etc. with sample args
// and JSON.stringify(result, null, 2) to a file.
```
