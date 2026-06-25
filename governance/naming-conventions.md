# PAC Naming Conventions

## Slack Action IDs

Format: `pac_<surface>_<action>`

| Prefix | Surface |
|--------|---------|
| `pac_notify_` | HR notification message buttons |
| `pac_modal_scenario_` | Scenario select modal actions |
| `pac_modal_question_` | Question flow modal actions |
| `pac_modal_result_` | Result/submit modal actions |
| `pac_followup_` | Follow-up thread actions |

Examples:
- `pac_notify_acknowledge` — HR acknowledges a submitted check
- `pac_notify_request_info` — HR requests more info
- `pac_notify_escalate` — HR escalates
- `pac_notify_view_case` — View full check on web
- `pac_modal_question_next` — Next question
- `pac_modal_question_back` — Back
- `pac_modal_result_send_to_hr` — Submit to HR
- `pac_modal_result_save` — Save for later

## Slack Callback IDs (modal view IDs)

Format: `pac_view_<name>`

- `pac_view_scenario_select`
- `pac_view_questions`
- `pac_view_result`

## Netlify Function Names

Format: `pac-<purpose>.js`

- `pac-slack-command.js` — slash command handler
- `pac-slack-events.js` — Block Kit interactions + Event API
- `pac-slack-oauth.js` — Slack app installation

## Netlify Blobs Namespaces

Format: `pac/<type>/<id>`

- `pac/cases/<caseId>` — case records
- `pac/config/hrEmail` — global HR email (shared with existing `hrEmail` key)
- `pac/audit/<caseId>/<timestamp>` — immutable audit entries (Phase 3)

## Environment Variables

Format: `PAC_<SERVICE>_<KEY>`

- `PAC_SLACK_BOT_TOKEN`
- `PAC_SLACK_SIGNING_SECRET`

## Source File Structure

```
src/core/       — shared business logic (no UI, no framework imports)
src/services/   — external service wrappers (fetch calls, storage)
src/config/     — configuration and governance definitions
src/slack/      — Slack plugin (builders, actions)
src/web/        — web layer (React components, Phase 3)
tests/core/     — unit tests for src/core/
tests/fixtures/ — shared test data
governance/     — governance docs and schemas
docs/           — architecture and decision records
```
