# Mobile QA Checklist — People Action Check

> Complete before any production rollout. Sign off on each item. Mark N/A only if the surface is not yet enabled.

---

## Web App — Mobile Browser

### Layout and Readability

- [ ] App loads on iOS Safari (iPhone SE and iPhone 15 Pro viewport)
- [ ] App loads on Android Chrome (Pixel 6 / Galaxy S22 equivalent)
- [ ] No horizontal scroll at 375px width
- [ ] Scenario selector dropdown is tappable without zoom
- [ ] Question text is readable at default font size (min 16px effective)
- [ ] Risk badge (Low / Elevated / High) is visible without scrolling past fold on first view
- [ ] Next Steps section is not clipped or cut off

### Interaction

- [ ] Yes / No / Don't Know radio buttons respond to tap, not just precision click
- [ ] Notes field opens mobile keyboard and accepts input without layout shift
- [ ] "Copy Report" button copies text to clipboard on iOS Safari
- [ ] "Copy Report" button copies text to clipboard on Android Chrome
- [ ] Email report flow opens native email client or web mailto
- [ ] Print / PDF export renders readable on mobile (landscape acceptable)

### localStorage Persistence

- [ ] Completed check appears in history after page reload on mobile Safari
- [ ] Settings (webhook URL, HR email) persist across mobile sessions
- [ ] Privacy mode clears history correctly on mobile

### Edge Cases

- [ ] App renders correctly in dark mode (iOS/Android system dark)
- [ ] No broken layout when browser font size set to Large (iOS Accessibility > Display & Text Size)
- [ ] Network offline: graceful message if Slack/email notification fails (no blank screen)

---

## Slack App — Mobile

> Requires the PAC Slack app to be installed and Slack mobile (iOS or Android) logged in to the same workspace.

### /pac Slash Command

- [ ] `/pac` command appears in Slack mobile autocomplete
- [ ] Ephemeral response renders with "Start New Check" button visible and tappable
- [ ] "View My Cases" and "Admin" buttons render below (or in overflow if screen is narrow)

### Intake Modal

- [ ] Modal opens on tap of "Start New Check"
- [ ] Multi-select scenario dropdown scrollable and selectable (no pinch required)
- [ ] Multiple scenarios can be selected without modal closing between taps
- [ ] "Employee / Situation Reference" field accepts keyboard input
- [ ] "Continue" button is above keyboard or accessible by scroll

### Questions Modal

- [ ] All questions visible (no content cut off on 375px width)
- [ ] Radio buttons (Yes / No / Don't Know) tappable with thumb
- [ ] ⚠️ critical question label visible
- [ ] "See Result" button reachable without horizontal scroll
- [ ] Modal submits and dismisses without error

### Result DM (Manager)

- [ ] Colored left border renders on mobile Slack (iOS + Android)
- [ ] "Notify HR" button is tappable (not too small)
- [ ] "Upload Documentation" button is tappable
- [ ] After HR notified: "HR Notified" context renders, "Notify HR" button absent, "Upload Documentation" still present
- [ ] Multiple scenarios listed in Scenario field without text overflow

### Upload Documentation Modal

- [ ] Tapping "Upload Documentation" opens file picker on mobile
- [ ] iOS: Files app, Photos, iCloud accessible
- [ ] Android: Files, Google Drive, Gallery accessible
- [ ] Selected files listed in modal before submission
- [ ] Up to 5 files selectable
- [ ] "Attach to Case" submits and modal dismisses

### HR Triage (#hr-team channel)

- [ ] Triage card renders with colored border in channel
- [ ] Overflow menu (⋮) accessible by tap
- [ ] Overflow options scroll if more than 5 options
- [ ] "Acknowledge" primary button tappable
- [ ] State changes (Acknowledge → In Review → Resolve) render updated card

### HR Reply Modal

- [ ] "Ask Follow-up" overflow option opens modal
- [ ] Multiline text input works on mobile keyboard
- [ ] "Send" button submits

### Manager Follow-up DM

- [ ] HR message text renders in manager DM
- [ ] "Reply to HR" button tappable
- [ ] Reply modal opens, text field works, "Send" submits

### App Home Tab

- [ ] PAC app home tab loads in Slack mobile
- [ ] "Start New Check" button tappable
- [ ] Scenarios section scrollable
- [ ] No "Active Cases" section visible (removed in Phase 4)
- [ ] "How It Works" content readable

---

## Sign-off

| Area | Tested by | Date | Status |
|------|-----------|------|--------|
| Web — iOS Safari | | | |
| Web — Android Chrome | | | |
| Slack mobile — iOS | | | |
| Slack mobile — Android | | | |

---

## Known Limitations (document, do not block)

- File upload via Slack `file_input` requires `files:read` + `files:write` OAuth scopes — must be added to Slack app manifest before upload feature is live
- Slack Block Kit colored borders (`attachments[].color`) render identically on mobile as on desktop
- Slack mobile does not support all Block Kit elements; overflow menus with more than 5 options may require scroll on older Slack versions (< 22.x)
