// PAC Slack governance — canonical action ID registry, surface rules, audit event types.
// CJS module (lives under netlify/functions/lib — same runtime as pac-slack.js / pac-blocks.js).
// This file is the naming authority — all action/callback/block IDs must be declared here
// before use in a handler or block builder. See GOVERNANCE_RULES below.
//
// Naming convention: pac_<surface>_<verb_or_noun>
//   surface tokens: slash | intake | q | result | hr | mgr | modal | reassign | doc
//   Block IDs:      pac_block_<name>
//   Callback IDs:   pac_modal_<name>

// ── Action IDs ────────────────────────────────────────────────────────────
const ACTION_IDS = {
  // Slash command ephemeral
  SLASH_OPEN_INTAKE:        'pac_slash_open_intake',
  SLASH_OPEN_SCENARIO:      'pac_slash_open_scenario',
  SLASH_LIST_CASES:         'pac_slash_list_cases',
  SLASH_HR_CASES:           'pac_slash_hr_cases',
  SLASH_EXPORT_CASES:       'pac_slash_export_cases',

  // Intake modal
  INTAKE_SCENARIO:          'pac_intake_scenario_select',
  INTAKE_REF_NAME:          'pac_intake_ref_name',

  // Questions modal (dynamic per question index — prefix only)
  Q_ANSWER_PREFIX:          'pac_q_answer_',

  // Result DM
  RESULT_NOTIFY_HR:         'pac_result_notify_hr',
  RESULT_OPEN_WEB:          'pac_result_open_web',
  RESULT_UPLOAD_DOC:        'pac_result_upload_doc',
  RESULT_EMAIL_SELF:        'pac_result_email_self',
  RESULT_SET_FOLLOWUP:      'pac_result_set_followup',

  // Upload documentation modal
  DOC_FILES:                'pac_doc_files',

  // HR triage message
  HR_ACKNOWLEDGE:           'pac_hr_acknowledge',
  HR_CLAIM:                 'pac_hr_claim',
  HR_MARK_REVIEW:           'pac_hr_mark_review',
  HR_ASK_FOLLOWUP:          'pac_hr_ask_followup',
  HR_REQUEST_INFO:          'pac_hr_request_info',
  HR_ESCALATE:              'pac_hr_escalate',
  HR_RESOLVE:                'pac_hr_resolve',
  HR_CLOSE:                 'pac_hr_close',
  HR_OPEN_WEB:              'pac_hr_open_web',
  HR_REASSIGN:              'pac_hr_reassign',
  HR_OVERFLOW:              'pac_hr_overflow',
  HR_CASE_ROW_OVERFLOW:     'pac_hr_case_row_overflow',
  HR_MESSAGE_INPUT:         'pac_hr_message_input',
  HR_RESOLUTION_INPUT:      'pac_hr_resolution_input',

  // HR policy library
  HR_POLICY_LIBRARY:        'pac_hr_policy_library',
  HR_UPLOAD_POLICY:         'pac_hr_upload_policy',
  HR_REMOVE_POLICY:         'pac_hr_remove_policy',
  POLICY_NAME_INPUT:        'pac_policy_name_input',
  POLICY_SCENARIO_SELECT:   'pac_policy_scenario_select',
  POLICY_FILE:              'pac_policy_file',

  // HR reassign modal
  REASSIGN_MANAGER_SELECT:  'pac_reassign_manager_select',
  REASSIGN_NOTE_INPUT:      'pac_reassign_note_input',

  // Manager follow-up thread
  MGR_REPLY:                'pac_mgr_reply',
  MGR_REPLY_INPUT:          'pac_mgr_reply_input',

  // HR case row overflow (from /pac hr cases list) — filter by manager
  CASE_ROW_FILTER_MGR:      'filter_mgr',

  // Export modal fields (scoped by block_id, collision-safe)
  EXPORT_FORMAT:            'format',
  EXPORT_FILTER:            'filter',
  EXPORT_DELIVERY:          'delivery',
  EXPORT_EMAIL:             'email',
};

// ── Block IDs ─────────────────────────────────────────────────────────────
const BLOCK_IDS = {
  SCENARIO:             'pac_block_scenario',
  REF_NAME:             'pac_block_ref_name',
  Q_PREFIX:             'pac_block_q_',    // + index
  HR_ACTIONS:           'pac_block_hr_actions',
  HR_MESSAGE:           'pac_block_hr_message',
  HR_RESOLUTION:        'pac_block_hr_resolution',
  MGR_REPLY:            'pac_block_mgr_reply',
  NEW_MANAGER:          'pac_block_new_manager',
  REASSIGN_NOTE:        'pac_block_reassign_note',
  DOC_UPLOAD:           'pac_block_doc_upload',
  POLICY_NAME:          'pac_block_policy_name',
  POLICY_SCENARIO:      'pac_block_policy_scenario',
  POLICY_FILE:          'pac_block_policy_file',
  EXPORT_FORMAT:        'export_format',
  EXPORT_FILTER:        'export_filter',
  EXPORT_DELIVERY:      'export_delivery',
  EXPORT_EMAIL:         'export_email',
};

// ── Callback IDs (modal view IDs) ─────────────────────────────────────────
const CALLBACK_IDS = {
  MODAL_INTAKE:         'pac_modal_intake',
  MODAL_QUESTIONS:      'pac_modal_questions',
  MODAL_HR_REPLY:       'pac_modal_hr_reply',
  MODAL_HR_RESOLVE:     'pac_modal_hr_resolve',
  MODAL_HR_REASSIGN:    'pac_modal_hr_reassign',
  MODAL_MGR_REPLY:      'pac_modal_mgr_reply',
  MODAL_EXPORT_CASES:   'pac_modal_export_cases',
  MODAL_UPLOAD_DOC:     'pac_modal_upload_doc',
  MODAL_POLICY_LIBRARY: 'pac_modal_policy_library',
};

// ── Surface rules ─────────────────────────────────────────────────────────
// Defines what content is allowed on each Slack surface.
// CRITICAL: Employee identity (name, ID, role) must NEVER appear in HR_TRIAGE surfaces.
// Full transcript and employee identity are available only in the web app or manager DMs.
const SURFACE_RULES = {
  MANAGER_DM:         { allowEmployeeName: true,  allowAnswers: true,  allowWebLink: true  },
  MANAGER_EPHEMERAL:  { allowEmployeeName: false, allowAnswers: false, allowWebLink: true  },
  HR_TRIAGE_CHANNEL:  { allowEmployeeName: false, allowAnswers: false, allowWebLink: true  },
  HR_TRIAGE_THREAD:   { allowEmployeeName: false, allowAnswers: false, allowWebLink: true  },
  HR_MODAL:           { allowEmployeeName: true,  allowAnswers: true,  allowWebLink: true  },
};

// ── Handoff triggers ──────────────────────────────────────────────────────
// Conditions that require or strongly suggest moving to the web app.
const HANDOFF_TRIGGERS = {
  HIGH_RISK:          true,   // always offer web link for High Risk result
  FOLLOWUP_THRESHOLD: 3,      // ≥3 follow-up exchanges → suggest web
  ESCALATED:          true,   // always offer web link after escalation
  ATTACHMENT_NEEDED:  true,   // any mention of docs/attachments → web
};

// ── Audit event types ─────────────────────────────────────────────────────
// Every HR/manager action that changes case state must write one of these
// to caseRecord.auditLog before responding.
const AUDIT_EVENTS = {
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
  DOCS_UPLOADED:      'DOCS_UPLOADED',
  CASE_REASSIGNED:    'CASE_REASSIGNED',
};

// ── Governance rules (human-readable) ────────────────────────────────────
// Reference for code review and onboarding.
const GOVERNANCE_RULES = [
  'All action IDs must be declared in ACTION_IDS before use in any handler.',
  'All block IDs must be declared in BLOCK_IDS before use in any modal builder.',
  'All callback IDs must be declared in CALLBACK_IDS before registering a view_submission handler.',
  'Employee identity (name, user ID, role) is prohibited in HR_TRIAGE_CHANNEL and HR_TRIAGE_THREAD surfaces.',
  'Every HR action must write an audit log entry to caseRecord.auditLog before calling any Slack API.',
  'Signing secret verification runs before any payload is parsed or acted upon.',
  'Bot token and signing secret are read from env vars only — never hardcoded or logged.',
  'High Risk cases must always receive a web handoff offer in the manager result DM.',
  'Cases with ≥3 follow-up exchanges must receive a web handoff suggestion in the HR thread.',
  'Uploaded documents are never attached to HR_TRIAGE surfaces directly — only referenced by case ID; full files are delivered via email or the web app.',
];

module.exports = {
  ACTION_IDS,
  BLOCK_IDS,
  CALLBACK_IDS,
  SURFACE_RULES,
  HANDOFF_TRIGGERS,
  AUDIT_EVENTS,
  GOVERNANCE_RULES,
};
