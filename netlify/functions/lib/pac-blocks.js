// Block Kit builder functions for all PAC Slack surfaces.
// CJS — used by pac-slack.js (Netlify Function).
// Surface rules enforced here:
//   - Employee identity never appears in HR triage channel messages (HR_TRIAGE surface)
//   - Employee identity allowed in manager DMs and HR modals

const { SCENARIO_NAMES } = require('./pac-data');

// ── Risk helpers ────────────────────────────────────────────────────────
function riskEmoji(level) {
  return { good: '🟢', warn: '🟡', risk: '🔴' }[level] || '⚪';
}
function riskLabel(level) {
  return { good: 'Low Risk', warn: 'Elevated Risk', risk: 'High Risk' }[level] || 'Unknown';
}
function stateLabel(state) {
  const map = {
    NOT_STARTED:       '⚪ Not Started',
    IN_PROGRESS_SLACK: '✏️ In Progress',
    SUBMITTED:         '📥 Submitted',
    ACKNOWLEDGED:      '👀 Acknowledged',
    UNDER_REVIEW:      '🔍 Under Review',
    ESCALATED:         '🚨 Escalated',
    CLOSED:            '✅ Closed',
    ARCHIVED:          '📁 Archived',
  };
  return map[state] || state;
}

// ── Scoring ─────────────────────────────────────────────────────────────
// Mirrors src/core/scoring.js. Answers: 'yes' | 'no' | 'unknown'
function computeScore(questions, answers) {
  let weightedNo = 0;
  let totalWeight = 0;
  let hasCriticalFlag = false;

  questions.forEach((q, i) => {
    const answer = answers[i];
    totalWeight += q.weight;
    if (answer === 'no') {
      weightedNo += q.weight;
      if (q.critical) hasCriticalFlag = true;
    } else if (answer === 'unknown') {
      weightedNo += q.weight * 0.75;
      if (q.critical) hasCriticalFlag = true;
    }
  });

  const ratio = totalWeight > 0 ? weightedNo / totalWeight : 0;
  const level = hasCriticalFlag
    ? 'risk'
    : ratio <= 0.15
    ? 'good'
    : ratio <= 0.45
    ? 'warn'
    : 'risk';

  return { level, hasCriticalFlag, ratio };
}

// ── Slash command ephemeral ─────────────────────────────────────────────
function slashResponseBlocks() {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*People Action Check*\nRun a structured HR risk check before taking action on an employee situation.',
      },
    },
    { type: 'divider' },
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
          text: { type: 'plain_text', text: 'My Cases', emoji: true },
          action_id: 'pac_slash_list_cases',
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
    submit: { type: 'plain_text', text: 'Continue →' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Select the scenario that best describes the situation you are reviewing.',
        },
      },
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
          placeholder: { type: 'plain_text', text: 'e.g. case-2026-06, initials, ticket number…' },
          max_length: 80,
        },
      },
    ],
  };
}

// ── Questions modal ──────────────────────────────────────────────────────
// privateMetadata: JSON string to round-trip { caseId, scenario, refName }
function questionsModal(scenario, questions, privateMetadata) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${scenario}*\nAnswer each question based on what you know right now.`,
      },
    },
    { type: 'divider' },
  ];

  questions.forEach((q, i) => {
    blocks.push({
      type: 'input',
      block_id: `pac_block_q_${i}`,
      label: { type: 'plain_text', text: `${i + 1}. ${q.q}` },
      ...(q.hint ? { hint: { type: 'plain_text', text: q.hint } } : {}),
      element: {
        type: 'radio_buttons',
        action_id: `pac_q_answer_${i}`,
        options: [
          { text: { type: 'plain_text', text: 'Yes' },         value: 'yes' },
          { text: { type: 'plain_text', text: 'No' },          value: 'no' },
          { text: { type: 'plain_text', text: "Don't know" }, value: 'unknown' },
        ],
      },
    });
    if (q.critical) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: "⚠️ *Critical* — a No or Don't Know answer here escalates to High Risk." }],
      });
    }
  });

  return {
    type: 'modal',
    callback_id: 'pac_modal_questions',
    title: { type: 'plain_text', text: 'Risk Assessment' },
    submit: { type: 'plain_text', text: 'See Result' },
    close: { type: 'plain_text', text: 'Back' },
    private_metadata: privateMetadata,
    blocks,
  };
}

// ── Result DM to manager ─────────────────────────────────────────────────
// Sent as a DM — employee identity allowed here (private).
function resultDmBlocks({ scenario, level, caseId, followupCount = 0, hrNotified = false }) {
  const emoji = riskEmoji(level);
  const label = riskLabel(level);

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'People Action Check — Result' },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Scenario*\n${scenario}` },
        { type: 'mrkdwn', text: `*Risk Level*\n${emoji} ${label}` },
        { type: 'mrkdwn', text: `*Case ID*\n\`${caseId}\`` },
      ],
    },
    { type: 'divider' },
  ];

  if (level === 'risk') {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🔴 *High Risk — HR review required before taking any action.*\nDo not proceed with any employee-facing action until you have received clearance from HR.',
      },
    });
  } else if (level === 'warn') {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🟡 *Elevated Risk — HR consultation recommended.*\nReview your documentation and confirm next steps with HR before proceeding.',
      },
    });
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🟢 *Low Risk — Routine situation.*\nProceed with careful documentation per your standard process.',
      },
    });
  }

  blocks.push({ type: 'divider' });

  if (hrNotified) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '✅ HR has been notified. They will follow up in Slack.' }],
    });
  } else {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '📬 Notify HR', emoji: true },
          style: level === 'risk' ? 'danger' : 'primary',
          action_id: 'pac_result_notify_hr',
          value: caseId,
        },
      ],
    });
  }

  // Handoff: always for high risk or after ≥3 follow-up exchanges
  if (level === 'risk' || followupCount >= 3) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Continue in the web app* for full case history, attachments, and HR review.\nCase ID: \`${caseId}\``,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: '🌐 Open Web App', emoji: true },
        action_id: 'pac_result_open_web',
        value: caseId,
      },
    });
  }

  return blocks;
}

// ── HR triage message ────────────────────────────────────────────────────
// Posted to PAC_HR_CHANNEL_ID. Employee identity NEVER included.
function hrTriageBlocks({ scenario, level, caseId, managerSlackId, submittedAt, state = 'SUBMITTED', claimedBy = null }) {
  const emoji = riskEmoji(level);
  const label = riskLabel(level);
  const date = new Date(submittedAt).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} New PAC Submission — ${label}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Scenario*\n${scenario}` },
        { type: 'mrkdwn', text: `*Risk Level*\n${emoji} ${label}` },
        { type: 'mrkdwn', text: `*Submitted by*\n<@${managerSlackId}>` },
        { type: 'mrkdwn', text: `*Submitted at*\n${date} ET` },
        { type: 'mrkdwn', text: `*Case ID*\n\`${caseId}\`` },
        { type: 'mrkdwn', text: `*Status*\n${stateLabel(state)}` },
      ],
    },
    { type: 'divider' },
  ];

  if (level === 'risk') {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '🔴 High Risk — review required before any manager action is taken.' }],
    });
  }

  if (claimedBy) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Claimed by <@${claimedBy}>` }],
    });
  }

  const actions = hrActionsForState(state, caseId);
  if (actions.length > 0) {
    blocks.push({ type: 'actions', block_id: 'pac_block_hr_actions', elements: actions });
  }

  return blocks;
}

function hrActionsForState(state, caseId) {
  const webBtn = {
    type: 'button',
    text: { type: 'plain_text', text: '🌐 Open in Web App', emoji: true },
    action_id: 'pac_hr_open_web',
    value: caseId,
  };

  if (state === 'SUBMITTED') {
    return [
      { type: 'button', text: { type: 'plain_text', text: '👀 Acknowledge', emoji: true }, style: 'primary', action_id: 'pac_hr_acknowledge', value: caseId },
      { type: 'button', text: { type: 'plain_text', text: '📋 Claim', emoji: true }, action_id: 'pac_hr_claim', value: caseId },
      webBtn,
    ];
  }
  if (state === 'ACKNOWLEDGED') {
    return [
      { type: 'button', text: { type: 'plain_text', text: '🔍 Mark In Review', emoji: true }, style: 'primary', action_id: 'pac_hr_mark_review', value: caseId },
      { type: 'button', text: { type: 'plain_text', text: '💬 Ask Follow-up', emoji: true }, action_id: 'pac_hr_ask_followup', value: caseId },
      { type: 'button', text: { type: 'plain_text', text: 'ℹ️ Request More Info', emoji: true }, action_id: 'pac_hr_request_info', value: caseId },
      { type: 'button', text: { type: 'plain_text', text: '⬆️ Escalate', emoji: true }, action_id: 'pac_hr_escalate', value: caseId },
      { type: 'button', text: { type: 'plain_text', text: '✅ Close', emoji: true }, action_id: 'pac_hr_close', value: caseId },
      webBtn,
    ];
  }
  if (state === 'UNDER_REVIEW') {
    return [
      { type: 'button', text: { type: 'plain_text', text: '💬 Ask Follow-up', emoji: true }, action_id: 'pac_hr_ask_followup', value: caseId },
      { type: 'button', text: { type: 'plain_text', text: 'ℹ️ Request More Info', emoji: true }, action_id: 'pac_hr_request_info', value: caseId },
      { type: 'button', text: { type: 'plain_text', text: '⬆️ Escalate', emoji: true }, action_id: 'pac_hr_escalate', value: caseId },
      { type: 'button', text: { type: 'plain_text', text: '✅ Resolve', emoji: true }, style: 'primary', action_id: 'pac_hr_resolve', value: caseId },
      webBtn,
    ];
  }
  if (state === 'ESCALATED') {
    return [
      { type: 'button', text: { type: 'plain_text', text: '✅ Close', emoji: true }, style: 'primary', action_id: 'pac_hr_close', value: caseId },
      webBtn,
    ];
  }
  return [webBtn];
}

// ── HR compose modal (ask follow-up or send message to manager) ──────────
function hrReplyModal(caseId, title = 'Send Message to Manager') {
  return {
    type: 'modal',
    callback_id: 'pac_modal_hr_reply',
    title: { type: 'plain_text', text: title },
    submit: { type: 'plain_text', text: 'Send' },
    close: { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ caseId }),
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Case \`${caseId}\` — your message is sent to the manager as a DM and posted in this thread.`,
        },
      },
      {
        type: 'input',
        block_id: 'pac_block_hr_message',
        label: { type: 'plain_text', text: 'Message' },
        element: {
          type: 'plain_text_input',
          action_id: 'pac_hr_message_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Type your message…' },
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
    close: { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ caseId }),
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `Resolving case \`${caseId}\`. Add a resolution note for the audit record.` },
      },
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

// ── Manager follow-up DM (HR asked a question) ───────────────────────────
function managerFollowupBlocks({ caseId, scenario, hrMessage, hrSlackId }) {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*HR Follow-up — People Action Check*\n*Scenario:* ${scenario} | *Case:* \`${caseId}\``,
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `<@${hrSlackId}> asks:\n> ${hrMessage}` },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '↩️ Reply to HR', emoji: true },
          style: 'primary',
          action_id: 'pac_mgr_reply',
          value: JSON.stringify({ caseId, scenario }),
        },
      ],
    },
  ];
}

// ── Manager reply modal ──────────────────────────────────────────────────
function managerReplyModal(caseId, scenario) {
  return {
    type: 'modal',
    callback_id: 'pac_modal_mgr_reply',
    title: { type: 'plain_text', text: 'Reply to HR' },
    submit: { type: 'plain_text', text: 'Send Reply' },
    close: { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ caseId, scenario }),
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${scenario}* | Case \`${caseId}\`` },
      },
      {
        type: 'input',
        block_id: 'pac_block_mgr_reply',
        label: { type: 'plain_text', text: 'Your reply to HR' },
        element: {
          type: 'plain_text_input',
          action_id: 'pac_mgr_reply_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Type your reply…' },
          max_length: 2000,
        },
      },
    ],
  };
}

// ── Case list DM ─────────────────────────────────────────────────────────
function caseListBlocks(cases) {
  if (!cases.length) {
    return [{
      type: 'section',
      text: { type: 'mrkdwn', text: 'No cases found. Use `/pac` to start a new check.' },
    }];
  }

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: 'Your People Action Check Cases' } },
  ];

  cases.slice(0, 10).forEach(c => {
    const emoji = riskEmoji(c.risk || 'good');
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${c.scenario}* — ${stateLabel(c.state)}\n\`${c.id}\` · ${new Date(c.createdAt).toLocaleDateString()}`,
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

// ── Slack-to-web handoff ephemeral ───────────────────────────────────────
function handoffBlocks({ caseId, reason }) {
  const reasons = {
    high_risk:  '🔴 This case is High Risk and requires full HR and legal review.',
    followup:   '💬 Multiple follow-up exchanges — use the web app for the full case view.',
    escalated:  '🚨 This case has been escalated — manage next steps in the web app.',
    attachment: '📎 Attachments and long-form notes require the full web app.',
  };
  const webUrl = `https://pachr.netlify.app`;
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Continue in the Web App*\n${reasons[reason] || 'Full functionality available in the web app.'}\nCase: \`${caseId}\``,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: '🌐 Open Web App', emoji: true },
        style: 'primary',
        action_id: 'pac_result_open_web',
        url: webUrl,
        value: caseId,
      },
    },
  ];
}

module.exports = {
  computeScore,
  riskEmoji,
  riskLabel,
  stateLabel,
  slashResponseBlocks,
  intakeModal,
  questionsModal,
  resultDmBlocks,
  hrTriageBlocks,
  hrReplyModal,
  hrResolveModal,
  managerFollowupBlocks,
  managerReplyModal,
  caseListBlocks,
  handoffBlocks,
};
