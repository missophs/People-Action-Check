// PAC Semantic State Definitions
// Maps risk levels, workflow states, and alert types to design tokens.
// Import this instead of hardcoding colors for any state-driven UI.
//
// Slack Block Kit notes: each state includes a `slotLabel` (short string safe for
// mrkdwn) and an `emoji` (Slack-compatible). Use these when building Block Kit surfaces.

import { COLOR } from './tokens.js';

// ─── Risk States ──────────────────────────────────────────────────────────────
// Keys match scoring.js LEVELS: 'good' | 'warn' | 'risk'

export const RISK_STATES = {
  good: {
    level:      'good',
    label:      'Low Risk',
    slotLabel:  'LOW RISK',
    emoji:      ':white_check_mark:',
    color:      COLOR.good,
    bg:         COLOR.goodBg,
    bgLight:    COLOR.goodBgLight,
    border:     COLOR.goodBorder,
    borderAlt:  COLOR.goodBorderAlt,
    light:      COLOR.goodLight,
    title:      'Routine management action — proceed carefully.',
    summary:    'Your answers indicate this situation is within standard management scope. Document each step you take.',
  },
  warn: {
    level:      'warn',
    label:      'Elevated Risk',
    slotLabel:  'ELEVATED RISK',
    emoji:      ':warning:',
    color:      COLOR.warn,
    bg:         COLOR.warnBg,
    bgLight:    COLOR.warnBgLight,
    border:     COLOR.warnBorder,
    borderAlt:  COLOR.warnBorderAlt,
    light:      COLOR.warnLight,
    title:      'Elevated risk — pause and address gaps before acting.',
    summary:    'One or more answers reveal gaps in process, documentation, or legal review. Resolve these before taking action.',
  },
  risk: {
    level:      'risk',
    label:      'High Risk',
    slotLabel:  'HIGH RISK',
    emoji:      ':rotating_light:',
    color:      COLOR.risk,
    bg:         COLOR.riskBg,
    bgLight:    COLOR.riskBgLight,
    border:     COLOR.riskBorder,
    borderAlt:  COLOR.riskBorderAlt,
    light:      COLOR.riskLight,
    title:      'High risk — do not proceed without HR or legal review.',
    summary:    'Critical risk factors are present. Acting without HR or legal involvement exposes you and the organization significantly.',
  },
};

// ─── Workflow States ──────────────────────────────────────────────────────────
// Keys match workflow.js CASE_STATES

export const WORKFLOW_STATES = {
  NOT_STARTED: {
    state:      'NOT_STARTED',
    label:      'Not started',
    emoji:      ':hourglass:',
    color:      COLOR.textMuted,
    bg:         COLOR.surface1,
    border:     COLOR.border1,
  },
  IN_PROGRESS_WEB: {
    state:      'IN_PROGRESS_WEB',
    label:      'In progress',
    sublabel:   'web',
    emoji:      ':pencil:',
    color:      COLOR.accent,
    bg:         COLOR.accentSurface,
    border:     COLOR.accentBorder,
  },
  IN_PROGRESS_SLACK: {
    state:      'IN_PROGRESS_SLACK',
    label:      'In progress',
    sublabel:   'Slack',
    emoji:      ':slack:',
    color:      COLOR.accent,
    bg:         COLOR.accentSurface,
    border:     COLOR.accentBorder,
  },
  SUBMITTED: {
    state:      'SUBMITTED',
    label:      'Submitted',
    emoji:      ':inbox_tray:',
    color:      COLOR.warn,
    bg:         COLOR.warnBg,
    border:     COLOR.warnBorder,
  },
  ACKNOWLEDGED: {
    state:      'ACKNOWLEDGED',
    label:      'Acknowledged',
    emoji:      ':eyes:',
    color:      COLOR.good,
    bg:         COLOR.goodBg,
    border:     COLOR.goodBorder,
  },
  UNDER_REVIEW: {
    state:      'UNDER_REVIEW',
    label:      'Under review',
    emoji:      ':mag:',
    color:      COLOR.warn,
    bg:         COLOR.warnBgLight,
    border:     COLOR.warnBorder,
  },
  ESCALATED: {
    state:      'ESCALATED',
    label:      'Escalated',
    emoji:      ':rotating_light:',
    color:      COLOR.risk,
    bg:         COLOR.riskBg,
    border:     COLOR.riskBorder,
  },
  CLOSED: {
    state:      'CLOSED',
    label:      'Closed',
    emoji:      ':white_check_mark:',
    color:      COLOR.textMuted,
    bg:         COLOR.surface1,
    border:     COLOR.border1,
  },
  ARCHIVED: {
    state:      'ARCHIVED',
    label:      'Archived',
    emoji:      ':file_cabinet:',
    color:      COLOR.textDim,
    bg:         COLOR.surface2,
    border:     COLOR.border0,
  },
};

// ─── Alert / Notice Types ─────────────────────────────────────────────────────
// Used for inline banners, callout panels, and toast messages.

export const ALERT_STATES = {
  info: {
    type:       'info',
    label:      'Info',
    emoji:      ':information_source:',
    color:      COLOR.accent,
    bg:         COLOR.accentSurface,
    border:     'rgba(34,193,255,0.18)',
    labelColor: COLOR.accentText70,
  },
  success: {
    type:       'success',
    label:      'Confirmed',
    emoji:      ':white_check_mark:',
    color:      COLOR.good,
    bg:         COLOR.goodBg,
    border:     COLOR.goodBorder,
    labelColor: COLOR.goodLight,
  },
  warning: {
    type:       'warning',
    label:      'Caution',
    emoji:      ':warning:',
    color:      COLOR.warn,
    bg:         COLOR.warnBgAlt,
    border:     COLOR.warnBorderDeep,
    labelColor: COLOR.warnLight,
  },
  escalation: {
    type:       'escalation',
    label:      'Critical',
    emoji:      ':rotating_light:',
    color:      COLOR.risk,
    bg:         COLOR.riskBgAlt,
    border:     COLOR.riskBorderMed,
    labelColor: COLOR.riskLight,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function riskState(level) {
  return RISK_STATES[level] ?? RISK_STATES.good;
}

export function workflowState(state) {
  return WORKFLOW_STATES[state] ?? WORKFLOW_STATES.NOT_STARTED;
}

export function alertForRisk(level) {
  const map = { good: 'success', warn: 'warning', risk: 'escalation' };
  return ALERT_STATES[map[level]] ?? ALERT_STATES.info;
}
