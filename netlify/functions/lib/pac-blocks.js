// Block Kit builder functions for all PAC Slack surfaces.
// CJS — used by pac-slack.js (Netlify Function).
//
// Design system:
//   Risk colors (colored attachment borders):
//     Low Risk     #34d399  emerald
//     Elevated     #f59e0b  amber
//     High Risk    #f43f5e  rose
//   These mirror tokens.css --pac-good / --pac-warn / --pac-risk.
//
// Surface rules:
//   HR_TRIAGE_CHANNEL — employee identity (name/ID) NEVER included
//   MANAGER_DM        — employee identity allowed (private)
//   APP_HOME          — manager's own context only

const { SCENARIO_NAMES, NEXT_STEPS } = require('./pac-data');

// ── Risk system ──────────────────────────────────────────────────────────

const RISK = {
  good: { color: '#34d399', emoji: '🟢', label: 'Low Risk',      dot: '●' },
  warn: { color: '#f59e0b', emoji: '🟡', label: 'Elevated Risk', dot: '●' },
  risk: { color: '#f43f5e', emoji: '🔴', label: 'High Risk',     dot: '●' },
};

function r(level) { return RISK[level] || RISK.good; }

const STATE_LABELS = {
  NOT_STARTED:       '○  Not Started',
  IN_PROGRESS_SLACK: '✏️  In Progress',
  SUBMITTED:         '📥  Submitted',
  ACKNOWLEDGED:      '👀  Acknowledged',
  UNDER_REVIEW:      '🔍  Under Review',
  ESCALATED:         '🚨  Escalated',
  CLOSED:            '✅  Closed',
  ARCHIVED:          '📁  Archived',
};

function stateLabel(state) { return STATE_LABELS[state] || state; }

// ── Scoring ──────────────────────────────────────────────────────────────
// Answers: 'yes' | 'no' | 'unknown'

function computeScore(questions, answers) {
  let weightedNo = 0, totalWeight = 0;
  let hasCriticalFlag = false;
  questions.forEach((q, i) => {
    const a = answers[i];
    totalWeight += q.weight;
    if (a === 'no')      { weightedNo += q.weight;        if (q.critical) hasCriticalFlag = true; }
    else if (a === 'unknown') { weightedNo += q.weight * 0.75; if (q.critical) hasCriticalFlag = true; }
  });
  const ratio = totalWeight > 0 ? weightedNo / totalWeight : 0;
  const level = hasCriticalFlag ? 'risk' : ratio <= 0.15 ? 'good' : ratio <= 0.45 ? 'warn' : 'risk';
  return { level, hasCriticalFlag, ratio };
}

// ── Slash command ephemeral ──────────────────────────────────────────────

function slashResponseBlocks() {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*People Action Check*\nStructured HR risk guidance before you act on an employee situation.',
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Choose a scenario, answer 5 risk questions, and get your risk level with recommended next steps — in under 2 minutes.',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Start New Check', emoji: true },
          style: 'primary',
          action_id: 'pac_slash_open_intake',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'My Cases',  emoji: true },
          action_id: 'pac_slash_list_cases',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open Web App', emoji: true },
          action_id: 'pac_result_open_web',
          value: '',
        },
      ],
    },
  ];
}

// ── Intake modal ─────────────────────────────────────────────────────────

function intakeModal() {
  return {
    type: 'modal',
    callback_id: 'pac_modal_intake',
    title: { type: 'plain_text', text: 'People Action Check' },
    submit: { type: 'plain_text', text: 'Continue' },
    close:  { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*What situation are you navigating?*\nSelect the scenario that best describes the employee situation you are reviewing.',
        },
      },
      { type: 'divider' },
      {
        type: 'input',
        block_id: 'pac_block_scenario',
        label: { type: 'plain_text', text: 'Scenario' },
        element: {
          type: 'static_select',
          action_id: 'pac_intake_scenario_select',
          placeholder: { type: 'plain_text', text: 'Choose a scenario…' },
          options: SCENARIO_NAMES.map(s => ({
            text: { type: 'plain_text', text: s },
            value: s,
          })),
        },
      },
      {
        type: 'input',
        block_id: 'pac_block_ref_name',
        optional: true,
        label: { type: 'plain_text', text: 'Internal reference (optional)' },
        hint: { type: 'plain_text', text: 'For your reference only — not shared with HR in Slack.' },
        element: {
          type: 'plain_text_input',
          action_id: 'pac_intake_ref_name',
          placeholder: { type: 'plain_text', text: 'e.g. initials, ticket #, case code…' },
          max_length: 80,
        },
      },
    ],
  };
}

// ── Questions modal ──────────────────────────────────────────────────────

function questionsModal(scenario, questions, privateMetadata) {
  const criticalCount = questions.filter(q => q.critical).length;
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${scenario}*\nAnswer each question based on what you know right now. Answer honestly — the risk level is only useful if it reflects reality.`,
      },
    },
    ...(criticalCount > 0 ? [{
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `⚠️  ${criticalCount} critical question${criticalCount > 1 ? 's' : ''} — a No or Don't Know answer escalates directly to High Risk.` }],
    }] : []),
    { type: 'divider' },
  ];

  questions.forEach((q, i) => {
    blocks.push({
      type: 'input',
      block_id: `pac_block_q_${i}`,
      label: { type: 'plain_text', text: `${i + 1}. ${q.q}${q.critical ? '  ⚠️' : ''}` },
      ...(q.hint ? { hint: { type: 'plain_text', text: q.hint } } : {}),
      element: {
        type: 'radio_buttons',
        action_id: `pac_q_answer_${i}`,
        options: [
          { text: { type: 'plain_text', text: 'Yes'       }, value: 'yes'     },
          { text: { type: 'plain_text', text: 'No'        }, value: 'no'      },
          { text: { type: 'plain_text', text: "Don't know"}, value: 'unknown' },
        ],
      },
    });
  });

  return {
    type: 'modal',
    callback_id: 'pac_modal_questions',
    title: { type: 'plain_text', text: 'Risk Assessment' },
    submit: { type: 'plain_text', text: 'See Result' },
    close:  { type: 'plain_text', text: 'Back' },
    private_metadata: privateMetadata,
    blocks,
  };
}

// ── Result DM to manager ─────────────────────────────────────────────────
// Returns { text, attachments } for chat.postMessage.
// Uses colored left border to signal risk level visually.
// Includes next steps so the DM is immediately actionable.

function resultDmMessage({ scenario, level, caseId, hrNotified = false, followupCount = 0 }) {
  const risk = r(level);
  const steps = NEXT_STEPS[scenario] || {};
  const stepList = steps[level === 'good' ? 'good' : level === 'warn' ? 'warn' : 'risk'] || [];

  const blocks = [
    // ── Identity header
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*People Action Check  ·  Result*`,
      },
    },
    { type: 'divider' },
    // ── Score card
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Scenario*\n${scenario}` },
        { type: 'mrkdwn', text: `*Risk Level*\n${risk.emoji}  ${risk.label}` },
        { type: 'mrkdwn', text: `*Case ID*\n\`${caseId}\`` },
        { type: 'mrkdwn', text: `*Status*\n${hrNotified ? '📬  HR Notified' : '⏳  Pending notification'}` },
      ],
    },
    { type: 'divider' },
    // ── Risk guidance
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: level === 'risk'
          ? `${risk.emoji}  *High Risk — stop and get HR clearance before taking any action.*\nDo not schedule meetings, issue warnings, or communicate anything to the employee until HR has reviewed this situation.`
          : level === 'warn'
          ? `${risk.emoji}  *Elevated Risk — HR consultation recommended before proceeding.*\nReview your documentation, address the gaps below, and confirm next steps with HR.`
          : `${risk.emoji}  *Low Risk — routine situation.*\nProceed with careful documentation following standard process.`,
      },
    },
  ];

  // ── Next steps (3 bullets, scenario-specific)
  if (stepList.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Recommended next steps:*\n${stepList.map(s => `•  ${s}`).join('\n')}`,
      },
    });
  }

  blocks.push({ type: 'divider' });

  // ── Actions
  if (hrNotified) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '✅  HR has been notified and will follow up in Slack.' }],
    });
  } else {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Notify HR', emoji: true },
          style: level === 'risk' ? 'danger' : 'primary',
          action_id: 'pac_result_notify_hr',
          value: caseId,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open Web App', emoji: true },
          action_id: 'pac_result_open_web',
          value: caseId,
        },
      ],
    });
  }

  // Web handoff prompt for high risk or ≥3 follow-ups
  if ((level === 'risk' || followupCount >= 3) && hrNotified) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `For full case history, attachments, and HR review — use the web app.\nCase: \`${caseId}\``,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Open Web App', emoji: true },
        style: 'primary',
        action_id: 'pac_result_open_web',
        value: caseId,
      },
    });
  }

  return {
    text: `People Action Check — ${risk.label}: ${scenario}`,
    attachments: [{ color: risk.color, blocks }],
  };
}

// ── HR triage message ────────────────────────────────────────────────────
// Posted to PAC_HR_CHANNEL_ID. Employee identity NEVER included.
// Uses colored border + overflow menu for secondary actions.

function hrTriageMessage({ scenario, level, caseId, managerSlackId, submittedAt, state = 'SUBMITTED', claimedBy = null }) {
  const risk = r(level);
  const date = new Date(submittedAt).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const blocks = [
    // ── Header
    {
      type: 'header',
      text: { type: 'plain_text', text: `${risk.emoji}  PAC Submission — ${risk.label}` },
    },
    { type: 'divider' },
    // ── Metadata grid
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Scenario*\n${scenario}` },
        { type: 'mrkdwn', text: `*Risk Level*\n${risk.emoji}  ${risk.label}` },
        { type: 'mrkdwn', text: `*Submitted by*\n<@${managerSlackId}>` },
        { type: 'mrkdwn', text: `*Submitted*\n${date} ET` },
        { type: 'mrkdwn', text: `*Case ID*\n\`${caseId}\`` },
        { type: 'mrkdwn', text: `*Status*\n${stateLabel(state)}` },
      ],
    },
  ];

  if (level === 'risk') {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '🔴  *High Risk — HR review required before any manager action is taken.*' },
    });
  }

  if (claimedBy) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Claimed by <@${claimedBy}>` }],
    });
  }

  blocks.push({ type: 'divider' });

  // ── Actions — primary button + overflow for secondary actions + web link
  const actionElements = buildHrActions(state, caseId);
  if (actionElements.length > 0) {
    blocks.push({ type: 'actions', block_id: 'pac_block_hr_actions', elements: actionElements });
  }

  return {
    text: `${risk.emoji} New PAC submission — ${risk.label}: ${scenario}`,
    attachments: [{ color: risk.color, blocks }],
  };
}

function buildHrActions(state, caseId) {
  const webBtn = {
    type: 'button',
    text: { type: 'plain_text', text: 'Web App', emoji: true },
    action_id: 'pac_hr_open_web',
    value: caseId,
  };

  // Overflow options available at each state
  const overflowOptionsByState = {
    SUBMITTED: [
      { text: { type: 'plain_text', text: '📋  Claim this case' }, value: `pac_hr_claim::${caseId}` },
      { text: { type: 'plain_text', text: '🌐  Open in Web App' }, value: `pac_hr_open_web::${caseId}` },
    ],
    ACKNOWLEDGED: [
      { text: { type: 'plain_text', text: '💬  Ask manager a follow-up' },  value: `pac_hr_ask_followup::${caseId}` },
      { text: { type: 'plain_text', text: 'ℹ️  Request more information' },  value: `pac_hr_request_info::${caseId}` },
      { text: { type: 'plain_text', text: '⬆️  Escalate this case' },        value: `pac_hr_escalate::${caseId}` },
      { text: { type: 'plain_text', text: '✅  Close case' },                value: `pac_hr_close::${caseId}` },
      { text: { type: 'plain_text', text: '🌐  Open in Web App' },           value: `pac_hr_open_web::${caseId}` },
    ],
    UNDER_REVIEW: [
      { text: { type: 'plain_text', text: '💬  Ask manager a follow-up' },  value: `pac_hr_ask_followup::${caseId}` },
      { text: { type: 'plain_text', text: 'ℹ️  Request more information' },  value: `pac_hr_request_info::${caseId}` },
      { text: { type: 'plain_text', text: '⬆️  Escalate this case' },        value: `pac_hr_escalate::${caseId}` },
      { text: { type: 'plain_text', text: '🌐  Open in Web App' },           value: `pac_hr_open_web::${caseId}` },
    ],
    ESCALATED: [
      { text: { type: 'plain_text', text: '🌐  Open in Web App' }, value: `pac_hr_open_web::${caseId}` },
    ],
  };

  if (state === 'SUBMITTED') {
    return [
      { type: 'button', text: { type: 'plain_text', text: 'Acknowledge' }, style: 'primary', action_id: 'pac_hr_acknowledge', value: caseId },
      { type: 'overflow', action_id: 'pac_hr_overflow', options: overflowOptionsByState.SUBMITTED },
    ];
  }
  if (state === 'ACKNOWLEDGED') {
    return [
      { type: 'button', text: { type: 'plain_text', text: 'Mark In Review' }, style: 'primary', action_id: 'pac_hr_mark_review', value: caseId },
      { type: 'overflow', action_id: 'pac_hr_overflow', options: overflowOptionsByState.ACKNOWLEDGED },
    ];
  }
  if (state === 'UNDER_REVIEW') {
    return [
      { type: 'button', text: { type: 'plain_text', text: 'Resolve', emoji: true }, style: 'primary', action_id: 'pac_hr_resolve', value: caseId },
      { type: 'overflow', action_id: 'pac_hr_overflow', options: overflowOptionsByState.UNDER_REVIEW },
    ];
  }
  if (state === 'ESCALATED') {
    return [
      { type: 'button', text: { type: 'plain_text', text: 'Close Case', emoji: true }, style: 'primary', action_id: 'pac_hr_close', value: caseId },
      { type: 'overflow', action_id: 'pac_hr_overflow', options: overflowOptionsByState.ESCALATED },
    ];
  }
  return [webBtn];
}

// ── App Home tab ─────────────────────────────────────────────────────────
// Enterprise dashboard surface. Published via views.publish.
// Shows active cases, quick start, and how-it-works.

function homeTabView(cases = []) {
  const active = cases
    .filter(c => !['CLOSED', 'ARCHIVED'].includes(c.state))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 8);

  const closed = cases
    .filter(c => ['CLOSED', 'ARCHIVED'].includes(c.state))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 3);

  const blocks = [
    // ── Masthead
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*People Action Check*\nStructured HR risk guidance before you act on an employee situation.\n_Answer 5 questions · Get your risk level · Know your next steps_',
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Start New Check', emoji: true },
        style: 'primary',
        action_id: 'pac_slash_open_intake',
      },
    },
    { type: 'divider' },
  ];

  // ── Active cases
  if (active.length > 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Active Cases  (${active.length})*` },
    });

    active.forEach(c => {
      const risk = r(c.risk || 'good');
      const date = new Date(c.updatedAt || c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${risk.emoji}  *${c.scenario}*\n${stateLabel(c.state)}  ·  \`${c.id}\`  ·  ${date}`,
        },
      });
    });

    blocks.push({ type: 'divider' });
  } else {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*Active Cases*\nNo active cases. Run `/pac` to start a new check.' },
    });
    blocks.push({ type: 'divider' });
  }

  // ── Recent closed cases
  if (closed.length > 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Recently Closed*` },
    });
    closed.forEach(c => {
      const risk = r(c.risk || 'good');
      const date = new Date(c.updatedAt || c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `${risk.emoji}  ${c.scenario}  ·  \`${c.id}\`  ·  ${date}` }],
      });
    });
    blocks.push({ type: 'divider' });
  }

  // ── Scenarios quick reference
  blocks.push(
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Scenarios covered*' },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: '🟢  Performance Decline\n🟢  Attendance Issue\n🟢  Interpersonal Conflict\n🟢  Policy Violation\n🟢  Leave of Absence' },
        { type: 'mrkdwn', text: '🔴  Termination Consideration\n🔴  Accommodation Request\n🔴  Harassment / Discrimination\n🔴  Retaliation Concern\n🔴  Reduction in Force' },
      ],
    },
    { type: 'divider' },
    // ── How it works
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*How it works*\n1.  Run `/pac` in any channel\n2.  Select your scenario and answer 5 risk questions\n3.  Get your risk level (Low / Elevated / High) with recommended next steps\n4.  Notify HR directly from Slack if needed\n5.  HR reviews, responds, and updates the case — all in Slack\n6.  Full case history, audit log, and documents available in the web app',
      },
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: 'People Action Check  ·  General guidance only — not legal advice.  ·  © 2026 Melissa A. Weiss' }],
    },
  );

  return { type: 'home', blocks };
}

// ── HR compose modal ─────────────────────────────────────────────────────

function hrReplyModal(caseId, title = 'Send Message to Manager') {
  return {
    type: 'modal',
    callback_id: 'pac_modal_hr_reply',
    title: { type: 'plain_text', text: title },
    submit: { type: 'plain_text', text: 'Send' },
    close:  { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ caseId }),
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Case \`${caseId}\`\nYour message will be sent to the manager as a DM and posted in the HR case thread.`,
        },
      },
      { type: 'divider' },
      {
        type: 'input',
        block_id: 'pac_block_hr_message',
        label: { type: 'plain_text', text: 'Message' },
        element: {
          type: 'plain_text_input',
          action_id: 'pac_hr_message_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Type your message to the manager…' },
          max_length: 2000,
        },
      },
    ],
  };
}

// ── HR resolve modal ─────────────────────────────────────────────────────

function hrResolveModal(caseId) {
  return {
    type: 'modal',
    callback_id: 'pac_modal_hr_resolve',
    title: { type: 'plain_text', text: 'Resolve Case' },
    submit: { type: 'plain_text', text: 'Resolve' },
    close:  { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ caseId }),
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `Resolving case \`${caseId}\`.\nAdd a resolution note — this goes into the permanent audit record.` },
      },
      { type: 'divider' },
      {
        type: 'input',
        block_id: 'pac_block_hr_resolution',
        label: { type: 'plain_text', text: 'Resolution note' },
        element: {
          type: 'plain_text_input',
          action_id: 'pac_hr_resolution_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Summarize the outcome and any action taken…' },
          max_length: 2000,
        },
      },
    ],
  };
}

// ── Manager follow-up DM ─────────────────────────────────────────────────

function managerFollowupMessage({ caseId, scenario, hrMessage, hrSlackId, level }) {
  const risk = r(level || 'good');
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'HR Follow-up — People Action Check' },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Scenario*\n${scenario}` },
        { type: 'mrkdwn', text: `*Case*\n\`${caseId}\`` },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `<@${hrSlackId}> asks:\n\n> ${hrMessage}` },
    },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reply to HR', emoji: true },
          style: 'primary',
          action_id: 'pac_mgr_reply',
          value: JSON.stringify({ caseId, scenario }),
        },
      ],
    },
  ];

  return {
    text: `HR follow-up on your People Action Check — ${scenario}`,
    attachments: [{ color: risk.color, blocks }],
  };
}

// ── Manager reply modal ──────────────────────────────────────────────────

function managerReplyModal(caseId, scenario) {
  return {
    type: 'modal',
    callback_id: 'pac_modal_mgr_reply',
    title: { type: 'plain_text', text: 'Reply to HR' },
    submit: { type: 'plain_text', text: 'Send Reply' },
    close:  { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ caseId, scenario }),
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${scenario}*  ·  Case \`${caseId}\`\nYour reply will be sent to the HR team.` },
      },
      { type: 'divider' },
      {
        type: 'input',
        block_id: 'pac_block_mgr_reply',
        label: { type: 'plain_text', text: 'Your reply' },
        element: {
          type: 'plain_text_input',
          action_id: 'pac_mgr_reply_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Type your reply to HR…' },
          max_length: 2000,
        },
      },
    ],
  };
}

// ── Case list (DM or Home) ────────────────────────────────────────────────

function caseListBlocks(cases) {
  if (!cases.length) {
    return [{
      type: 'section',
      text: { type: 'mrkdwn', text: '*Your People Action Check Cases*\nNo cases yet. Run `/pac` to start your first check.' },
    }];
  }

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: 'Your People Action Check Cases' } },
    { type: 'divider' },
  ];

  cases.slice(0, 10).forEach(c => {
    const risk = r(c.risk || 'good');
    const date = new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${risk.emoji}  *${c.scenario}*\n${stateLabel(c.state)}  ·  \`${c.id}\`  ·  ${date}`,
      },
    });
  });

  if (cases.length > 10) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `+${cases.length - 10} more cases — open the web app to see all.` }],
    });
  }

  return blocks;
}

// ── Handoff ───────────────────────────────────────────────────────────────

function handoffBlocks({ caseId, reason }) {
  const msgs = {
    high_risk:  '🔴  *High Risk case* — continue in the web app for full HR and legal review, case history, and document management.',
    followup:   '💬  This case has multiple exchanges. Use the web app for the complete case view.',
    escalated:  '🚨  *Escalated case* — manage next steps and legal review in the web app.',
    attachment: '📎  Attachments and long-form notes require the full web app.',
  };
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${msgs[reason] || 'Continue in the web app for full functionality.'}\nCase: \`${caseId}\``,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Open Web App', emoji: true },
        style: 'primary',
        action_id: 'pac_result_open_web',
        value: caseId,
      },
    },
  ];
}

module.exports = {
  computeScore,
  r,
  stateLabel,
  slashResponseBlocks,
  intakeModal,
  questionsModal,
  resultDmMessage,
  hrTriageMessage,
  homeTabView,
  hrReplyModal,
  hrResolveModal,
  managerFollowupMessage,
  managerReplyModal,
  caseListBlocks,
  handoffBlocks,
};
