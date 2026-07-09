# Enterprise Release Guide — People Action Check Slack App

> Complete this guide before cutting a production Slack app install. All items are required unless marked optional.

---

## 1. Slack App Configuration

### OAuth Scopes (Bot Token)

Add all of the following in your Slack app manifest under `oauth_config.scopes.bot`:

| Scope | Required for |
|-------|-------------|
| `commands` | `/pac` slash command |
| `chat:write` | Post DMs and channel messages |
| `chat:write.public` | Post to channels PAC bot is not a member of |
| `im:write` | Open DM conversations with managers |
| `views:open` | Open modals (intake, questions, upload) |
| `views:publish` | Publish App Home tab |
| `users:read` | Resolve Slack user IDs to display names |
| `channels:read` | Verify HR channel exists |
| `files:read` | Read uploaded files (Upload Documentation feature) |
| `files:write` | Write/share uploaded files to case records |

> `files:read` and `files:write` are required for the Upload Documentation button. If not yet ready, you can ship without them and the upload modal will still open — just not save files.

### Slack App Manifest Checklist

- [ ] `display_information.name` set to `People Action Check` (or org-branded name)
- [ ] `slash_commands` entry for `/pac` pointing to `https://<your-netlify-url>/api/pac-slack`
- [ ] `interactivity.request_url` set to `https://<your-netlify-url>/api/pac-slack`
- [ ] `interactivity.message_menu_options_url` not required (no external select menus)
- [ ] `features.app_home.home_tab_enabled: true`
- [ ] `features.app_home.messages_tab_enabled: false` (PAC does not use the Messages tab)
- [ ] `event_subscriptions.request_url` set to same `/api/pac-slack` endpoint
- [ ] `event_subscriptions.bot_events` includes `app_home_opened`
- [ ] All OAuth scopes listed above present in manifest

---

## 2. Environment Variables (Netlify)

Set all of the following in the Netlify dashboard under **Site Settings → Environment Variables**. All are required before the Slack app works in production.

| Variable | Value | Notes |
|----------|-------|-------|
| `PAC_SLACK_BOT_TOKEN` | `xoxb-…` | Bot token from Slack app OAuth page |
| `PAC_SLACK_SIGNING_SECRET` | From Slack app Basic Information | Used to verify request signatures |
| `PAC_HR_CHANNEL_ID` | e.g. `C08XXXXXXXX` | Slack channel ID of #hr-team (not channel name) |
| `BREVO_API_KEY` | From Brevo account | Already set — verify still valid |
| `BREVO_SENDER_EMAIL` | Verified sender address | Already set — verify still valid |
| `PAC_ADMIN_TOKEN` | Strong random string | Already set — used to protect write endpoints |

> To find a channel ID: open the channel in Slack web → URL contains `/C08XXXXXXXX`. Do not use the channel name — it can be renamed.

---

## 3. Netlify Function Routing

Verify `netlify.toml` routes `/api/pac-slack` to `netlify/functions/pac-slack.js`:

```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

If your Netlify function is named `pac-slack.js`, the redirect above maps `/api/pac-slack` → `/.netlify/functions/pac-slack`. Confirm this is present.

---

## 4. Slack App Install Flow (Workspace Admin)

1. **Create the app** in your Slack workspace at api.slack.com/apps
2. Paste the manifest (configure scopes, slash command, interactivity URL, events URL as above)
3. Click **Install to Workspace** — review and approve the OAuth permission screen
4. Copy the **Bot User OAuth Token** (`xoxb-…`) and set it as `PAC_SLACK_BOT_TOKEN` in Netlify
5. Copy the **Signing Secret** from Basic Information and set as `PAC_SLACK_SIGNING_SECRET`
6. In your #hr-team channel, add the PAC bot: `/invite @People Action Check`
7. Run `/pac` in any channel to confirm the app responds

---

## 5. Production Validation Checklist

Complete after deploying with all env vars set.

### Endpoint Health

- [ ] `GET https://<your-netlify-url>/api/pac-slack` returns 405 (Method Not Allowed) — confirms function is live
- [ ] Netlify Functions log shows no cold-start errors

### End-to-End Smoke Test

- [ ] `/pac` in Slack returns ephemeral response with 3 buttons
- [ ] "Start New Check" opens intake modal
- [ ] Select 1 scenario, enter reference name, click Continue — questions modal opens
- [ ] Answer all questions, click See Result — manager receives DM with result card
- [ ] "Notify HR" sends card to #hr-team — verify card appears with colored border
- [ ] HR clicks Acknowledge — card updates to ACKNOWLEDGED state
- [ ] HR clicks Ask Follow-up (overflow) — HR reply modal opens, send message
- [ ] Manager receives follow-up DM with "Reply to HR" button
- [ ] Manager replies — message appears in HR thread
- [ ] HR clicks Resolve — resolve modal opens, close note submitted
- [ ] App Home tab loads when any user opens the PAC app home

### Multi-Scenario Test

- [ ] Select 2+ scenarios in intake modal
- [ ] Result DM shows primary scenario + additional scenario names
- [ ] HR triage card shows primary scenario correctly

### Upload Documentation Test (if `files:read`/`files:write` scopes enabled)

- [ ] "Upload Documentation" button opens modal with file input
- [ ] Attach 1 file, click "Attach to Case"
- [ ] Case record in Netlify Blobs updated with file reference (verify via admin endpoint or Blob store inspection)

---

## 6. Governance and Signoff Expectations

### Who Signs Off Before Production

| Role | Signs off on |
|------|-------------|
| HR lead or People Ops head | Content accuracy — scenarios, questions, next steps, risk levels |
| IT / Workspace admin | Slack app OAuth scope approval, channel configuration |
| Legal / Compliance | Confirm no PII stored in Netlify Blobs beyond case reference ID |
| Security | Signing secret handling, PAC_ADMIN_TOKEN strength, no secrets in code |
| Product owner | Feature completeness, mobile QA checklist completed |

### Data and Privacy

- Case records stored in **Netlify Blobs** — key-value store scoped to the Netlify site. No external database.
- Case records contain: case ID, scenario, risk level, state, manager Slack ID, timestamps. They do not contain employee name, HR determinations, or free-text notes from the web app.
- File uploads (if enabled) are Slack-hosted — PAC stores only the Slack file ID and URL. Files are subject to Slack's own retention policy.
- Web app check history is stored in **browser localStorage only** — never sent to any server.

### Rollback Plan

| Scenario | Action |
|----------|--------|
| Slack function returns 500 on all requests | Disable the Netlify function (set `PAC_SLACK_BOT_TOKEN` to an invalid value or rename the function file) — Slack will return a generic error, no data loss |
| Bad deploy breaks `/pac` response | `git revert` to last good commit on `webhooks` branch — Netlify auto-redeploys in ~60s |
| Slack signing secret compromised | Rotate secret in Slack app → update `PAC_SLACK_SIGNING_SECRET` in Netlify env → redeploy |
| Netlify Blobs data corrupted | Case records can be rebuilt from Slack message timestamps — no single source of truth is lost |
| Wrong HR channel ID | Update `PAC_HR_CHANNEL_ID` in Netlify env → no redeploy needed (env var read at function invocation) |

---

## 7. Rollout Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Slack request timeout (3s limit for ack) | Medium | `ack()` called before any async work; Netlify cold-start time is the main threat — warm by pre-pinging the endpoint |
| Rate limiting from Slack API (`chat.postMessage`) | Low | PAC sends at most 2–3 messages per check; no batch sending |
| Netlify Blobs quota exceeded | Very low | Each case record is <2KB; 10,000 cases = ~20MB |
| `files:write` scope rejected by workspace admin | Medium | Ship without upload feature first; add scope in a follow-up |
| HR channel ID changes (channel renamed/archived) | Low | Use channel ID (immutable), not name |
| Multi-select scenario payload missing `selected_options` | Low | Handler defaults to `[]` → first scenario is `undefined` → modal shows empty questions. Add input validation before questionsModal call. |

---

## 8. Phased Rollout Recommendation

1. **Pilot (week 1)**: Install in a test workspace. Run smoke tests. HR team and 2–3 managers only.
2. **Soft launch (week 2)**: Install in production workspace. Restrict `/pac` to specific channels or user groups via Slack channel permissions.
3. **Full rollout (week 3+)**: Open to all managers. Monitor Netlify Function logs for errors. Set up a Slack alert on function failure (optional).
4. **Upload feature**: Ship separately once `files:read`/`files:write` scopes are approved and the `pac_modal_upload_doc` view_submission handler is complete.
