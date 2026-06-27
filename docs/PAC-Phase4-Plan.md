# PAC Enterprise Redesign + Phase 4: Slack Plugin

## Order of work
1. **Enterprise web UI redesign** (FIRST — do this before Phase 4)
2. **Phase 4: Slack plugin** (after redesign is approved)

---

## Part 1: Enterprise Web UI Redesign

### Why
Current web UI at `pachr.netlify.app` uses the Phase 3 design system (tokens, components) but does not look enterprise-grade visually. User confirmed redesign is required before building Phase 4.

### Current state (audit complete)
- Dark navy theme (`#020617` base), cyan accent (`#22c1ff`), risk palette: emerald/amber/rose
- 72 CSS custom property tokens in `src/design-system/tokens.css`
- System font stack (`-apple-system, Segoe UI, sans-serif`) — no branded typeface
- All icons are emoji — no icon library
- No loading states / skeleton screens
- No CSS classes — all styling is inline JSX style objects in `src/web/App.jsx`
- 5 major views: PIN Gate, Policy Library (modal), Scenario Picker, Questions, Result
- CDN libs: React 18, Babel Standalone 7, docx 8.6.0 — no CSS framework

### What enterprise redesign means
Keep: dark theme, cyan/emerald/amber/rose risk palette, mobile-first, accessibility, 8px spacing scale, card radius system.

Add/change:
- **Typography**: Replace system font with Inter (Google Fonts CDN, already free)
- **Icons**: Replace emoji with Heroicons or Lucide (CDN, SVG sprites) for consistent enterprise look
- **Loading states**: Skeleton cards while async operations run
- **Transitions**: Fade-in on view changes, slide-up on modals
- **HR Dashboard**: Redesign as table layout with status badges, filtering, bulk actions
- **Navigation**: Add a slim sidebar or top nav once logged in as HR admin
- **Elevated surfaces**: Stronger shadows and layering for modals/cards
- **Form polish**: Better input focus states, label positioning, inline validation

### Files to touch
- `src/design-system/tokens.css` — add typography tokens, update shadow scale
- `src/web/App.jsx` — replace emoji icons, add transition wrappers, restructure HR Dashboard
- `index.html` — add Inter font CDN link, add icon library CDN link

---

## Part 2: Phase 4 — Slack Plugin MVP

### New files
| File | Purpose |
|------|---------|
| `netlify/functions/pac-slack.js` | Main entry point — slash command + interaction handler |
| `netlify/functions/pac-slack-actions.js` | Action dispatch router |
| `src/slack/blocks.js` | Block Kit builder functions for all surfaces |
| `src/slack/workflow.js` | Slack-specific workflow state |
| `src/slack/governance.js` | Action ID registry, surface rules, audit helpers |

### Existing files to touch
| File | Change |
|------|--------|
| `netlify.toml` | Add `/api/pac-slack` route |
| `src/core/workflow.js` | `transitionCase()` called from Slack handlers |
| `src/services/cases.js` | Already built — imported by Slack handler |

### Build order: A → B → C → D → E

**A. Foundation**
- `governance.js`: action ID constants, surface rules, handoff triggers, audit event types
- `blocks.js`: all Block Kit builder functions (slash response, intake modal, questions modal, result DM, HR triage, HR reply modal, manager follow-up, case list)
- `pac-slack.js`: signing secret verify, slash command route, block_actions route, view_submission route

**B. Manager workflow**
`/pac` → ephemeral → intake modal → questions modal → result DM → [Notify HR]

**C. HR workflow**
HR triage message → Acknowledge / Reply / Escalate / Open Web → case state updates in Blobs

**D. Manager ↔ HR loop**
Threaded follow-up, audit log entry on every exchange

**E. Slack-to-web handoff**
High Risk, file attachments, ≥3 follow-ups → ephemeral message with deep link to `pachr.netlify.app/case/<caseId>`

### Governance controls
- All action IDs declared as named constants in `governance.js`
- Every HR action writes to `caseRecord.auditLog[]` in Blobs before responding
- Employee name never echoed in Slack; full transcript only in web app
- `transitionCase()` throws on invalid state transitions — Slack handler catches + ephemeral error

### Env vars needed (Netlify PAC site)
| Var | Source |
|-----|--------|
| `PAC_SLACK_BOT_TOKEN` | User to provide (xoxb-...) |
| `PAC_SLACK_SIGNING_SECRET` | Slack app Basic Information page |
| `PAC_HR_CHANNEL_ID` | Slack channel ID for HR triage messages |

Slash command URL + Interactivity Request URL: `https://pachr.netlify.app/api/pac-slack`

### Block Kit surfaces designed (see conversation for full JSON)
1. `/pac` slash command response (ephemeral)
2. Manager intake modal (`pac_view_intake`)
3. Questions modal (`pac_view_questions`)
4. Result DM to manager
5. HR triage message + Acknowledge/Reply/Escalate buttons
6. HR reply modal (`pac_view_hr_reply`)
7. Manager follow-up threaded DM

### Verification
1. `/pac` → ephemeral appears
2. Intake → questions modal pushes
3. Submit → manager DM with correct risk level
4. Notify HR → HR channel triage message
5. HR acknowledges → message updates
6. HR replies → manager thread updated
7. `GET /api/case-store?managerId=<id>` → correct state + auditLog
8. High Risk → web handoff link in result DM

### Not in Phase 4
- App Home tab
- Vite build pipeline
- Rate limiting
- Slack OAuth / multi-workspace
