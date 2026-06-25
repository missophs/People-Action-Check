// PAC Component Registry
// Canonical spec for every reusable UI component in the design system.
// Each entry defines: naming, required props, accessibility requirements,
// and Slack Block Kit conceptual equivalent (for future parity).
//
// This file is governance — it does not render anything.
// Before adding a new component, add its spec here first.

import { COLOR, FONT, RADIUS, TRANSITION } from './tokens.js';

// ─── Component Naming Rules ───────────────────────────────────────────────────
// Web components:    PascalCase React components, e.g. RiskBadge, AlertBanner
// CSS class names:   kebab-case, prefixed pac-, e.g. pac-scenario-grid
// Slack surfaces:    pac_<surface>_<name>, e.g. pac_web_risk_badge
// Action IDs:        pac_<surface>_<action>, e.g. pac_slack_submit_check
// Callback IDs:      pac_view_<name>, e.g. pac_view_result_modal

// ─── Component Specs ─────────────────────────────────────────────────────────

export const COMPONENT_REGISTRY = {

  // ── RiskBadge
  // Small pill showing risk level. Used in scenario cards and result screens.
  RiskBadge: {
    name:        'RiskBadge',
    cssClass:    'pac-risk-badge',
    slackEquiv:  'mrkdwn bold text with emoji prefix',
    props: {
      level:     { type: "'good'|'warn'|'risk'", required: true },
    },
    a11y: {
      role:      'status',
      ariaLabel: 'Risk level: {label}',
    },
    notes: 'Never convey risk through color alone — always include the text label.',
  },

  // ── AlertBanner
  // Full-width inline banner for info, success, warning, or escalation notices.
  AlertBanner: {
    name:        'AlertBanner',
    cssClass:    'pac-alert-banner',
    slackEquiv:  'section block with mrkdwn, colored via emoji indicator',
    props: {
      type:      { type: "'info'|'success'|'warning'|'escalation'", required: true },
      children:  { type: 'ReactNode', required: true },
      icon:      { type: 'string', required: false },
    },
    a11y: {
      role:      'alert',
      ariaLive:  'polite',    // use assertive only for escalation type
    },
    notes: 'For escalation type set aria-live="assertive" so screen readers announce immediately.',
  },

  // ── QuestionCard
  // Single question row with Yes / No / ? answer buttons and optional notes textarea.
  QuestionCard: {
    name:        'QuestionCard',
    cssClass:    'pac-question-card',
    slackEquiv:  'section block + actions block (radio or button set)',
    props: {
      index:     { type: 'number', required: true },
      total:     { type: 'number', required: true },
      question:  { type: 'string', required: true },
      hint:      { type: 'string', required: true },
      critical:  { type: 'boolean', required: false },
      answer:    { type: "'yes'|'no'|'unknown'|null", required: true },
      note:      { type: 'string', required: false },
      onAnswer:  { type: '(val: string) => void', required: true },
      onNote:    { type: '(val: string) => void', required: false },
    },
    a11y: {
      fieldsetLegend: 'Question {index} of {total}: {question}',
      answerBtns:     'role="radio" within role="radiogroup"',
      noteLabel:      'Associated with question via aria-labelledby',
    },
    notes: 'Answer buttons must meet 44px touch target on mobile (enforced via tokens.css).',
  },

  // ── ProgressBar
  // Horizontal progress bar for check completion status.
  ProgressBar: {
    name:        'ProgressBar',
    cssClass:    'pac-progress-bar',
    slackEquiv:  'context block with text like "3 of 5 answered"',
    props: {
      answered:  { type: 'number', required: true },
      total:     { type: 'number', required: true },
    },
    a11y: {
      role:      'progressbar',
      ariaValueNow: 'answered',
      ariaValueMin: '0',
      ariaValueMax: 'total',
      ariaLabel: '{answered} of {total} questions answered',
    },
    notes: 'Never rely solely on the visual fill — always render the numeric text label.',
  },

  // ── ScenarioCard
  // Clickable card for selecting an HR scenario.
  ScenarioCard: {
    name:        'ScenarioCard',
    cssClass:    'pac-scenario-card',
    slackEquiv:  'button element in actions block',
    props: {
      name:      { type: 'string', required: true },
      icon:      { type: 'string', required: true },
      riskLevel: { type: 'string', required: true },
      riskLabel: { type: 'string', required: true },
      active:    { type: 'boolean', required: false },
      onClick:   { type: '() => void', required: true },
    },
    a11y: {
      role:      'button',
      ariaPressed: 'active',
      ariaLabel: '{icon} {name} — {riskLabel}',
    },
    notes: 'Active state conveyed by border color AND aria-pressed — not color alone.',
  },

  // ── ResultCard
  // Primary result display: risk level, title, summary, next steps.
  ResultCard: {
    name:        'ResultCard',
    cssClass:    'pac-result-card',
    slackEquiv:  'header block + section block + divider + numbered list in mrkdwn',
    props: {
      level:     { type: "'good'|'warn'|'risk'", required: true },
      score:     { type: '{ yes, no, unk, crit, level }', required: true },
      steps:     { type: 'string[]', required: true },
    },
    a11y: {
      section:   'role="region" aria-label="Assessment result"',
      heading:   'h2 for result title',
    },
    notes: 'The crit flag must surface as a prominent visible warning, not just a color change.',
  },

  // ── PrimaryButton
  // Primary CTA button — accent-colored outline.
  PrimaryButton: {
    name:        'PrimaryButton',
    cssClass:    'pac-btn-primary',
    slackEquiv:  'button element with style: "primary"',
    props: {
      children:  { type: 'ReactNode', required: true },
      onClick:   { type: '() => void', required: false },
      disabled:  { type: 'boolean', required: false },
      type:      { type: "'button'|'submit'", required: false, default: 'button' },
    },
    a11y: {
      minTarget: '44px height on mobile',
      disabled:  'aria-disabled when disabled prop is true',
    },
    notes: 'Never use opacity alone to convey disabled — also set aria-disabled.',
  },

  // ── GhostButton
  // Secondary / ghost button — low-prominence.
  GhostButton: {
    name:        'GhostButton',
    cssClass:    'pac-btn-ghost',
    slackEquiv:  'button element with default style',
    props: {
      children:  { type: 'ReactNode', required: true },
      onClick:   { type: '() => void', required: false },
    },
    a11y: {
      minTarget: '44px height on mobile',
    },
    notes: 'Use for secondary actions that should not compete with the primary CTA.',
  },

  // ── LiveLevelIndicator
  // Inline badge showing the current in-progress risk level as answers are given.
  LiveLevelIndicator: {
    name:        'LiveLevelIndicator',
    cssClass:    'pac-live-level',
    slackEquiv:  'context block, updated via response_action replace',
    props: {
      level:     { type: "'neutral'|'good'|'warn'|'risk'", required: true },
      message:   { type: 'string', required: true },
    },
    a11y: {
      role:      'status',
      ariaLive:  'polite',
      ariaLabel: 'Current risk level: {message}',
    },
    notes: 'Transitions smoothly (--pac-transition-base). Do not flash on every keystroke.',
  },
};

// ─── Page Patterns ────────────────────────────────────────────────────────────
// Named layout patterns (not individual components).
// Documented here for consistency across web and Slack surfaces.

export const PAGE_PATTERNS = {

  CheckFlow: {
    pattern:  'CheckFlow',
    steps:    ['pick', 'context', 'questions', 'result'],
    web:      'Single-page scroll; step driven by React state.',
    slack:    'Modal views per step (pac_view_pick, pac_view_context, pac_view_questions, pac_view_result).',
    notes:    'All steps must be reachable from history/resume.',
  },

  ResultSummary: {
    pattern:  'ResultSummary',
    web:      'Inline scroll section below questions.',
    slack:    'Separate result modal with next-steps list.',
    notes:    'Must show: risk level, title, summary, numbered steps, answer breakdown.',
  },

  PolicyLibrary: {
    pattern:  'PolicyLibrary',
    web:      'Slide-over modal with tabbed interface.',
    slack:    'Not yet surfaced — Phase 4.',
    notes:    'Policy documents are per-company; content is browser-local only.',
  },
};

// ─── Style Helper — generate inline style objects from tokens ─────────────────
// These helpers are used directly in index.html until a build step exists.
// They match the `s` object patterns in the app and can be replaced by
// CSS class names once the React component layer is extracted in Phase 4.

export const styleHelpers = {
  card: {
    background:   COLOR.surface0,
    border:       `1px solid ${COLOR.border1}`,
    borderRadius: RADIUS.card,
    padding:      '18px 20px',
    marginBottom: 20,
  },
  label: {
    fontSize:        FONT.size.xs,
    letterSpacing:   FONT.tracking.label,
    textTransform:   'uppercase',
    color:           COLOR.textMuted,
    marginBottom:    10,
    display:         'block',
  },
  btn: (primary) => ({
    padding:      primary ? '10px 20px' : '8px 16px',
    borderRadius: RADIUS.full,
    border:       primary
      ? `1px solid ${COLOR.accentBorder}`
      : `1px solid ${COLOR.border3}`,
    background:   primary ? COLOR.accentBg : COLOR.surface1,
    color:        primary ? COLOR.accent : COLOR.text,
    cursor:       'pointer',
    fontSize:     FONT.size.md,
    fontWeight:   600,
    fontFamily:   'inherit',
    transition:   TRANSITION.fast,
  }),
  badge: (level) => {
    const map = {
      good: { bg: COLOR.goodBg, border: COLOR.goodBorder, color: COLOR.good },
      warn: { bg: COLOR.warnBg, border: COLOR.warnBorder, color: COLOR.warn },
      risk: { bg: COLOR.riskBg, border: COLOR.riskBorder, color: COLOR.risk },
    };
    const t = map[level] || map.good;
    return {
      display:       'inline-flex',
      alignItems:    'center',
      fontSize:      FONT.size.xxs,
      fontWeight:    700,
      letterSpacing: FONT.tracking.xs,
      textTransform: 'uppercase',
      padding:       '2px 7px',
      borderRadius:  RADIUS.badge,
      background:    t.bg,
      border:        `1px solid ${t.border}`,
      color:         t.color,
      marginTop:     6,
    };
  },
};
