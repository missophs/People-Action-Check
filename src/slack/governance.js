// PAC Slack governance — canonical action ID registry, surface rules, audit event types.
// ESM module. Referenced by pac-slack.js (CJS) via inline constants for now;
// this file is the naming authority — all action IDs must be declared here first.
//
// Naming convention: pac_<surface>_<verb_or_noun>
//   surface tokens: slash | intake | q | result | hr | mgr | modal
//   Block IDs:      pac_block_<name>
//   Callback IDs:   pac_modal_<name>

// ── Action IDs ────────────────────────────────────────────────────────────
export const ACTION_IDS = {
  // Slash command ephemeral
  SLASH_OPEN_INTAKE:    'pac_slash_open_intake',
  SLASH_LIST_CASES:     'pac_slash_list_cases',

  // Intake modal
  INTAKE_SCENARIO:      'pac_intake_scenario_select',
  INTAKE_REF_NAME:      'pac_intake_ref_name',

  // Questions modal (dynamic per question index — prefix only)
  Q_ANSWER_PREFIX:      'pac_q_answer_',

  // Result DM
  RESULT_NOTIFY_HR:     'pac_result_notify_hr',
  RESULT_OPEN_WEB:      'pac_result_open_web',

  // HR triage message
  HR_ACKNOWLEDGE:       'pac_hr_acknowledge',
  HR_CLAIM:             'pac_hr_claim',
  HR_MARK_REVIEW:       'pac_hr_mark_review',
  HR_ASK_FOLLOWUP:      'pac_hr_ask_followup',
  HR_REQUEST_INFO:      'pac_hr_request_info',
  HR_ESCALATE:          'pac_hr_escalate',
  HR_RESOLVE:           'pac_hr_resolve',
  HR_CLOSE:             'pac_hr_close',
  HR_OPEN_WEB:          'pac_hr_open_web',

  // Manager follow-up thread
  MGR_REPLY:            'pac_mgr_reply',
};

// ── Block IDs ─────────────────────────────────────────────────────────────
export const BLOCK_IDS = {
  SCENARIO:             'pac_block_scenario',
  REF_NAME:             'pac_block_ref_name',
  Q_PREFIX:             'pac_block_q_',    // + index
  HR_ACTIONS:           'pac_block_hr_actions',
  HR_MESSAGE:           'pac_block_hr_message',
  HR_RESOLUTION:        'pac_block_hr_resolution',
  MGR_REPLY:            'pac_block_mgr_reply',
};

// ── Callback IDs (modal view IDs) ─────────────────────────────────────────
export const CALLBACK_IDS = {
  MODAL_INTAKE:         'pac_modal_intake',
  MODAL_QUESTIONS:      'pac_modal_questions',
  MODAL_HR_REPLY:       'pac_modal_hr_reply',
  MODAL_HR_RESOLVE:     'pac_modal_hr_resolve',
  MODAL_MGR_REPLY:      'pac_modal_mgr_reply',
};

// ── Surface rules ─────────────────────────────────────────────────────────
// Defines what content is allowed on each Slack surface.
// CRITICAL: Employee identity (name, ID, role) must NEVER appear in HR_TRIAGE surfaces.
// Full transcript and employee identity are available only in the web app or manager DMs.
export const SURFACE_RULES = {
  MANAGER_DM:         { allowEmployeeName: true,  allowAnswers: true,  allowWebLink: true  },
  MANAGER_EPHEMERAL:  { allowEmployeeName: false, allowAnswers: false, allowWebLink: true  },
  HR_TRIAGE_CHANNEL:  { allowEmployeeName: false, allowAnswers: false, allowWebLink: true  },
  HR_TRIAGE_THREAD:   { allowEmployeeName: false, allowAnswers: false, allowWebLink: true  },
  HR_MODAL:           { allowEmployeeName: true,  allowAnswers: true,  allowWebLink: true  },
};

// ── Handoff triggers ──────────────────────────────────────────────────────
// Conditions that require or strongly suggest moving to the web app.
export const HANDOFF_TRIGGERS = {
  HIGH_RISK:          true,   // always offer web link for High Risk result
  FOLLOWUP_THRESHOLD: 3,      // ≥3 follow-up exchanges → suggest web
  ESCALATED:          true,   // always offer web link after escalation
  ATTACHMENT_NEEDED:  true,   // any mention of docs/attachments → web
};

// ── Audit event types ─────────────────────────────────────────────────────
// Every HR action must write one of these to caseRecord.auditLog before responding.
export const AUDIT_EVENTS = {
  CASE_CREATED:       'CASE_CREATED',
  SUBMITTED_SLACK:    'SUBMITTED_SLACK',
  HR_NOTIFIED:        'HR_NOTIFIED',
  HR_ACKNOWLEDGED:    'HR_ACKNOWLEDGED',
  HR_CLAIMED:         'HR_CLAIMED',
  HR_MARKED_REVIEW:   'HR_MARKED_REVIEW',
  HR_ASKED_FOLLOWUP:  'HR_ASKED_FOLLOWUP',
  HR_REQUESTED_INFO:  'HR_REQUESTED_INFO',
  HR_ESCALATED:       'HR_ESCALATED',
  HR_RESOLVED:        'HR_RESOLVED',
  HR_CLOSED:          'HR_CLOSED',
  MGR_REPLIED:        'MGR_REPLIED',
  WEB_HANDOFF:        'WEB_HANDOFF',
};

// ── Governance rules (human-readable) ────────────────────────────────────
// Reference for code review and onboarding.
export const GOVERNANCE_RULES = [
  'All action IDs must be declared in ACTION_IDS before use in any handler.',
  'All block IDs must be declared in BLOCK_IDS before use in any modal builder.',
  'All callback IDs must be declared in CALLBACK_IDS before registering a view_submission handler.',
  'Employee identity (name, user ID, role) is prohibited in HR_TRIAGE_CHANNEL and HR_TRIAGE_THREAD surfaces.',
  'Every HR action must write an audit log entry to caseRecord.auditLog before calling any Slack API.',
  'Signing secret verification runs before any payload is parsed or acted upon.',
  'Bot token and signing secret are read from env vars only — never hardcoded or logged.',
  'High Risk cases must always receive a web handoff offer in the manager result DM.',
  'Cases with ≥3 follow-up exchanges must receive a web handoff suggestion in the HR thread.',
];
