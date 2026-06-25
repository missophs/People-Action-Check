# PAC Design System Governance

All rules below apply to any change made to `src/design-system/`, component patterns in `src/web/`, or shared styles used by Slack surfaces. Governance is enforced at code review — not at CI (yet).

---

## 1. Component Naming Rules

| Surface | Convention | Example |
|---|---|---|
| React component | PascalCase | `RiskBadge`, `AlertBanner` |
| CSS class | kebab-case, `pac-` prefix | `pac-risk-badge`, `pac-question-row` |
| Slack action ID | `pac_<surface>_<action>` | `pac_slack_submit_check` |
| Slack callback ID | `pac_view_<name>` | `pac_view_result_modal` |
| Netlify Function | `pac-<purpose>.js` | `pac-submit-check.js` |
| Blobs namespace | `pac/<type>/<id>` | `pac/cases/abc123` |
| Env var | `PAC_<SERVICE>_<KEY>` | `PAC_SLACK_BOT_TOKEN` |

**Rule:** Never use a generic, unprefixed name for a PAC component. `Button` is wrong. `PrimaryButton` or `pac-btn-primary` is correct.

---

## 2. Token Usage Rules

- **No raw hex values or rgba strings in component code.** Import from `src/design-system/tokens.js` or use a CSS custom property from `tokens.css`.
- **CSS custom properties** are for CSS-consuming surfaces (web). The JS token object is for Slack Block Kit and any non-CSS surface.
- When a new color is needed: add it to `tokens.js` first, then sync to `tokens.css`. Never add it directly to a component file.
- Token names follow the pattern: `--pac-<category>-<variant>` (CSS) or `COLOR.<category><Variant>` (JS).

---

## 3. Documentation Requirements

Every component in the registry (`src/design-system/components.js`) must have:

- [ ] `name` — PascalCase
- [ ] `cssClass` — kebab-case, `pac-` prefixed
- [ ] `slackEquiv` — Block Kit conceptual equivalent (or "Not yet surfaced — Phase N")
- [ ] `props` — all required props with types
- [ ] `a11y` — ARIA role, label pattern, and any live region requirements
- [ ] `notes` — at least one sentence of non-obvious constraints

Before adding a component to the app, add its spec here first. The spec is the interface contract.

---

## 4. Fixture / Example Requirements

Any component that handles risk levels, scoring output, or workflow state transitions must have a corresponding fixture in `tests/fixtures/`.

Existing fixtures:
- `tests/fixtures/scenarios.fixture.js` — 10 scenarios with question data
- `tests/fixtures/submissions.fixture.js` — sample submissions across all risk levels

When adding a new component:
- [ ] Create or update a fixture that covers the Low / Elevated / High risk states
- [ ] Create or update a fixture that covers the critical question auto-escalation path
- [ ] Fixture data must be deterministic (no `Date.now()`, no `Math.random()`)

---

## 5. Accessibility Requirements

All web components must meet WCAG 2.1 AA before merge.

**Mandatory for every interactive component:**
- [ ] Keyboard navigable (Tab, Enter, Space)
- [ ] `:focus-visible` style applied (do not remove the global rule in `tokens.css`)
- [ ] Touch target minimum: 44px × 44px on mobile (enforced via `.ans-btn` in `tokens.css`)
- [ ] Never convey state through color alone — always pair with a text label or icon
- [ ] ARIA role and label defined in the component registry spec

**Risk and state components specifically:**
- [ ] `RiskBadge`: `role="status"` + text label
- [ ] `AlertBanner`: `role="alert"`, `aria-live="polite"` (use `"assertive"` for escalation type only)
- [ ] `ProgressBar`: `role="progressbar"` + `aria-valuenow` / `aria-valuemin` / `aria-valuemax` + text fallback
- [ ] `QuestionCard`: answer buttons use `role="radio"` within `role="radiogroup"`

---

## 6. Mobile Review Requirements

Before any component is considered done, it must be tested at:

| Breakpoint | Width | Behavior check |
|---|---|---|
| Wide desktop | 1280px+ | Full grid, no wrapping issues |
| Desktop | 1024px | Default layout |
| Tablet | 768px | Reduced padding, slightly narrower grid |
| Mobile | 600px | Single-column scenario grid, stacked question rows, 44px touch targets |
| Small mobile | 390px | Reduced gaps, no horizontal overflow |

Specific checks on mobile (600px):
- [ ] Scenario grid: single-column (`pac-scenario-grid`)
- [ ] Question rows: stacked vertically (`pac-question-row`)
- [ ] Answer buttons: full-width row, 44px min height (`pac-ans-group`)
- [ ] Result actions: stacked full-width (`pac-result-actions`)
- [ ] Email row: stacked (`pac-email-row`)
- [ ] No input triggers iOS zoom (font-size ≥ 16px on `.notes-ta`, `.email-input`)
- [ ] No horizontal scroll at any breakpoint

---

## 7. Contribution Rules

### Adding a new shared component

1. Add the spec to `src/design-system/components.js` under `COMPONENT_REGISTRY`
2. Add required tokens to `tokens.js` (and sync `tokens.css`) if new values are needed
3. Implement the component in `src/web/components/` (React) or `src/slack/` (Block Kit)
4. Add a fixture in `tests/fixtures/` covering all risk states
5. Add accessibility attributes per Section 5
6. Test at all five breakpoints per Section 6

### Changing a shared component

1. Update the spec in `COMPONENT_REGISTRY` first
2. If the change affects Slack surfaces, note the Block Kit equivalent impact in the PR
3. If the change removes a prop, check all call sites — no silent breakage

### Changing design tokens

1. Update `tokens.js` — this is the source of truth
2. Sync the changed values to `tokens.css`
3. Update any hardcoded values in `index.html` that reference the old value (search for the raw hex/rgba)
4. Document what changed and why in the PR description

### What requires a design review

Changes to these always require a second pair of eyes before merge:
- Any change to a risk-level color (good / warn / risk)
- Any change to the accent color or accent gradient
- Any change to the base background color
- Adding a new alert type to `ALERT_STATES`
- Any change that affects how risk level is conveyed to users

---

## 8. What Lives Where

| Concern | File |
|---|---|
| Color, type, spacing tokens | `src/design-system/tokens.js` + `tokens.css` |
| Risk / workflow / alert state definitions | `src/design-system/states.js` |
| Component specs and naming rules | `src/design-system/components.js` |
| Governance rules | `governance/design-system-governance.md` (this file) |
| Naming conventions (non-design) | `governance/naming-conventions.md` |
| Audit log schema | `governance/audit-log-schema.js` |
| Ownership and contacts | `governance/ownership.md` |
