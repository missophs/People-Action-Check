# Airtable Setup — People Action Check

## Why Airtable

HR can open the base directly and see every case, filter by risk level, state, manager, or date — no technical knowledge required. Export to CSV or Excel in one click. Build Airtable views for things like "All High Risk cases open >7 days" without any code.

## Setup Steps

1. Go to airtable.com and create a free account
2. Create a new **Base** — name it `People Action Check`
3. Rename the default table to `Cases`
4. Create the fields below (delete any default fields Airtable creates)
5. Create a Personal Access Token at airtable.com/create/tokens with scopes: `data.records:read`, `data.records:write`
6. Find your Base ID: open the base in the browser → the URL contains `/appXXXXXXXXXXXXXX` — that's the base ID
7. Set Netlify env vars:
   - `PAC_DATA_STORE=airtable`
   - `AIRTABLE_API_KEY=your_personal_access_token`
   - `AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX`
   - `AIRTABLE_TABLE_NAME=Cases` (or whatever you named it)

## Table: Cases

| Field name | Field type | Notes |
|-----------|-----------|-------|
| Case ID | Single line text | Primary identifier — e.g. `pac_abc123_xyz` |
| Manager Slack ID | Single line text | Slack user ID of submitting manager |
| Scenario | Single line text | Primary scenario |
| All Scenarios | Long text | JSON array — multiple scenarios selected |
| Reference | Single line text | Manager's internal reference (optional, private) |
| Risk Level | Single select | Options: `good` `warn` `risk` |
| State | Single select | Options: `NOT_STARTED` `IN_PROGRESS_WEB` `IN_PROGRESS_SLACK` `SUBMITTED` `ACKNOWLEDGED` `UNDER_REVIEW` `ESCALATED` `CLOSED` `ARCHIVED` |
| Source | Single select | Options: `web` `slack` |
| Answers | Long text | JSON array of yes/no/unknown answers |
| Created At | Date (include time) | ISO 8601, set on creation |
| Updated At | Date (include time) | ISO 8601, updated on every change |
| HR Notified | Checkbox | Checked when manager clicked Notify HR |
| HR Channel ID | Single line text | Slack channel ID of #hr-team message |
| HR Channel Timestamp | Single line text | Slack message ts for threading |
| DM Timestamp | Single line text | Manager's result DM ts |
| DM Channel ID | Single line text | Manager's DM channel ID |
| Follow-up Count | Number | Integer — how many HR↔manager exchanges |
| Attachments JSON | Long text | JSON array of file refs |
| Audit Log | Long text | JSON array of audit events |

## Recommended Airtable Views (create these in the base)

| View name | Filter | Sort | Use |
|-----------|--------|------|-----|
| HR Queue | HR Notified = true, State not in CLOSED/ARCHIVED | Risk Level (risk first), Updated At desc | HR daily triage |
| High Risk Open | Risk Level = risk, State not in CLOSED/ARCHIVED | Updated At desc | Escalation watch |
| All Active | State not in CLOSED/ARCHIVED | Updated At desc | Overview |
| Closed This Month | State = CLOSED, Updated At this month | Created At desc | Monthly reporting |

## Differences vs Supabase

| | Airtable | Supabase |
|--|---------|---------|
| HR can view directly | ✅ Yes — opens in browser like a spreadsheet | ❌ Requires SQL or a separate dashboard |
| Export to CSV/Excel | ✅ One click | Requires pg_dump or CSV export tool |
| Real querying | Limited — formula filters only | ✅ Full SQL |
| Performance at scale | Slower (5 req/s rate limit, 50k row free limit) | ✅ Fast, millions of rows |
| Compliance/security | Basic | ✅ Row-level security, SOC 2, GDPR, EU hosting |
| Setup complexity | Low | Medium |
| Cost | Free to $20/user/month | Free to $25/month flat |
