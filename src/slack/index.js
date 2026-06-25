// Slack plugin entry point — scaffold for Phase 3.
//
// This module will house:
//   - Slash command handler (/peoplecheck)
//   - Action router (maps block_actions callback_ids to handlers)
//   - View submission handler (multi-step question modal)
//   - HR notification message builder
//
// Governance requirements (enforced in Phase 3):
//   - All inbound Slack requests must validate signing secret before any processing
//   - Bot token: PAC_SLACK_BOT_TOKEN env var only — never in code
//   - Signing secret: PAC_SLACK_SIGNING_SECRET env var only — never in code
//   - Action IDs follow: pac_<surface>_<action> (see governance/naming-conventions.md)
//   - All Slack interaction payloads must be logged for audit (High Risk cases)

export const SLACK_SURFACES = {
  SLASH_COMMAND:       'slash_command',
  SCENARIO_MODAL:      'pac_modal_scenario_select',
  QUESTION_MODAL:      'pac_modal_questions',
  RESULT_MODAL:        'pac_modal_result',
  HR_NOTIFICATION:     'pac_msg_hr_notification',
  FOLLOWUP_THREAD:     'pac_msg_followup_thread',
  HANDOFF_MESSAGE:     'pac_msg_handoff',
};

export const SCAFFOLD_STATUS = 'pending-phase-3';
