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
const { ACTION_IDS: A, BLOCK_IDS: B, CALLBACK_IDS: C } = require('./governance');

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
        text: ':shield:  *People Action Check*\nGet HR guidance before you act. Private, confidential, under 2 minutes.',
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Run a Check', emoji: true },
        style: 'primary',
        action_id: A.SLASH_OPEN_INTAKE,
      },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: ':lock:  Private to you — nothing is posted to this channel' }],
    },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'My Cases', emoji: true },
          action_id: A.SLASH_LIST_CASES,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'HR Queue', emoji: true },
          action_id: A.SLASH_HR_CASES,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Export', emoji: true },
          action_id: A.SLASH_EXPORT_CASES,
        },
      ],
    },
  ];
}

// ── Intake modal ─────────────────────────────────────────────────────────

function intakeModal() {
  return {
    type: ‘modal’,
    callback_id: C.MODAL_INTAKE,
    title: { type: ‘plain_text’, text: ‘New Check’ },
    submit: { type: ‘plain_text’, text: ‘Start’ },
    close:  { type: ‘plain_text’, text: ‘Cancel’ },
    blocks: [
      {
        type: ‘context’,
        elements: [{ type: ‘mrkdwn’, text: ‘:lock:  Private to you — results are never posted to any channel’ }],
      },
      { type: ‘divider’ },
      {
        type: ‘input’,
        block_id: B.SCENARIO,
        label: { type: ‘plain_text’, text: ‘What are you dealing with?’ },
        hint: { type: ‘plain_text’, text: ‘Pick the closest match. Select multiple if this spans more than one situation — questions will come from your first choice.’ },
        element: {
          type: ‘multi_static_select’,
          action_id: A.INTAKE_SCENARIO,
          placeholder: { type: ‘plain_text’, text: ‘Choose a situation...’ },
          options: SCENARIO_NAMES.map(s => ({
            text: { type: ‘plain_text’, text: s },
            value: s,
          })),
        },
      },
      { type: ‘divider’ },
      {
        type: ‘input’,
        block_id: B.REF_NAME,
        optional: true,
        label: { type: ‘plain_text’, text: ‘Employee reference (optional)’ },
        hint: { type: ‘plain_text’, text: ‘A short private code you will recognize (e.g. initials). Only visible to you. Required if you want to escalate to HR later.’ },
        element: {
          type: ‘plain_text_input’,
          action_id: A.INTAKE_REF_NAME,
          placeholder: { type: ‘plain_text’, text: ‘e.g. J.D.’ },
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
        text: `*${scenario}*\nAnswer based on what you know right now. Honest answers give you a useful result.`,
      },
    },
    ...(criticalCount > 0 ? [{
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `⚠️  ${criticalCount} critical question${criticalCount > 1 ? 's' : ''} in this set — answering No or Don't know on any of them raises the result to High Risk.` }],
    }] : []),
    { type: 'divider' },
  ];

  questions.forEach((q, i) => {
    blocks.push({
      type: 'input',
      block_id: `${B.Q_PREFIX}${i}`,
      label: { type: 'plain_text', text: `${i + 1}. ${q.q}` },
      ...(q.hint || q.critical ? {
        hint: { type: 'plain_text', text: q.critical
          ? `${q.hint ? q.hint + '  ' : ''}Critical — No or Don't know raises this to High Risk.`
          : q.hint },
      } : {}),
      element: {
        type: 'radio_buttons',
        action_id: `${A.Q_ANSWER_PREFIX}${i}`,
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
    callback_id: C.MODAL_QUESTIONS,
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

function resultDmMessage({ scenario, scenarios = [scenario], level, caseId, hrNotified = false, followupCount = 0, refName = '' }) {
  const selfCheck = !refName;
  const risk = r(level);
  const steps = NEXT_STEPS[scenario] || {};
  const stepList = steps[level === 'good' ? 'good' : level === 'warn' ? 'warn' : 'risk'] || [];
  const scenarioDisplay = scenarios.length > 1
    ? `${scenario}\n_+ ${scenarios.slice(1).join(', ')}_`
    : scenario;

  const statusFlag = selfCheck
    ? ':lock:  Private check'
    : hrNotified ? ':white_check_mark:  HR notified' : ':hourglass_flowing_sand:  Awaiting HR';

  const guidanceText = level === 'risk'
    ? `:red_circle:  *High Risk — stop. HR clearance required before any action.*\nDo not schedule meetings, issue warnings, or communicate with the employee until HR has reviewed this case.`
    : level === 'warn'
    ? `:yellow_circle:  *Elevated Risk — consult HR before you proceed.*\nAddress the documentation gaps below and confirm your next move with HR first.`
    : `:large_green_circle:  *Low Risk — routine situation.*\nProceed using standard process. Keep a record of this conversation and any actions you take.`;

  const blocks = [
    // ── Case header — scenario + case ID + status in one compact line
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${scenarioDisplay}*\n\`${caseId}\`  ·  ${statusFlag}`,
      },
    },
    { type: 'divider' },
    // ── Risk guidance — lead with what matters most
    {
      type: 'section',
      text: { type: 'mrkdwn', text: guidanceText },
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
  if (selfCheck) {
    // No employee name → self-check only, HR never notified
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '🔒  This check is saved to your history only. HR has not been notified and cannot be notified without an employee reference.' }],
    });
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open Web App', emoji: true },
          action_id: A.RESULT_OPEN_WEB,
          value: caseId,
        },
      ],
    });
  } else if (hrNotified) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '✅  HR has been notified and will follow up in Slack.' }],
    });
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Upload Documentation', emoji: true },
          action_id: A.RESULT_UPLOAD_DOC,
          value: caseId,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open Web App', emoji: true },
          action_id: A.RESULT_OPEN_WEB,
          value: caseId,
        },
      ],
    });
  } else {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Notify HR', emoji: true },
          style: level === 'risk' ? 'danger' : 'primary',
          action_id: A.RESULT_NOTIFY_HR,
          value: caseId,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Upload Documentation', emoji: true },
          action_id: A.RESULT_UPLOAD_DOC,
          value: caseId,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open Web App', emoji: true },
          action_id: A.RESULT_OPEN_WEB,
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
        action_id: A.RESULT_OPEN_WEB,
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
    // ── Case header — scenario + key facts in one scannable line
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${risk.emoji}  *${scenario}*  ·  ${risk.label}\n<@${managerSlackId}>  ·  ${date} ET  ·  \`${caseId}\`  ·  ${stateLabel(state)}`,
      },
    },
    { type: 'divider' },
  ];

  if (level === 'risk') {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ':red_circle:  *High Risk — manager is awaiting HR clearance. Review and respond before any action is taken.*' },
    });
    blocks.push({ type: 'divider' });
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
    blocks.push({ type: 'actions', block_id: B.HR_ACTIONS, elements: actionElements });
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
    action_id: A.HR_OPEN_WEB,
    value: caseId,
  };

  const reassignOpt = { text: { type: 'plain_text', text: '🔄  Reassign to another manager' }, value: `${A.HR_REASSIGN}::${caseId}` };

  // Overflow options available at each state
  const policyOpt = { text: { type: 'plain_text', text: '📎  Upload company policy' }, value: `${A.HR_POLICY_LIBRARY}::${caseId}` };

  const overflowOptionsByState = {
    SUBMITTED: [
      { text: { type: 'plain_text', text: '📋  Claim this case' }, value: `${A.HR_CLAIM}::${caseId}` },
      reassignOpt,
      policyOpt,
      { text: { type: 'plain_text', text: '🌐  Open in Web App' }, value: `${A.HR_OPEN_WEB}::${caseId}` },
    ],
    ACKNOWLEDGED: [
      { text: { type: 'plain_text', text: '💬  Ask manager a follow-up' },  value: `${A.HR_ASK_FOLLOWUP}::${caseId}` },
      { text: { type: 'plain_text', text: 'ℹ️  Request more information' },  value: `${A.HR_REQUEST_INFO}::${caseId}` },
      { text: { type: 'plain_text', text: '⬆️  Escalate this case' },        value: `${A.HR_ESCALATE}::${caseId}` },
      reassignOpt,
      policyOpt,
      { text: { type: 'plain_text', text: '✅  Close case' },                value: `${A.HR_CLOSE}::${caseId}` },
      { text: { type: 'plain_text', text: '🌐  Open in Web App' },           value: `${A.HR_OPEN_WEB}::${caseId}` },
    ],
    UNDER_REVIEW: [
      { text: { type: 'plain_text', text: '💬  Ask manager a follow-up' },  value: `${A.HR_ASK_FOLLOWUP}::${caseId}` },
      { text: { type: 'plain_text', text: 'ℹ️  Request more information' },  value: `${A.HR_REQUEST_INFO}::${caseId}` },
      { text: { type: 'plain_text', text: '⬆️  Escalate this case' },        value: `${A.HR_ESCALATE}::${caseId}` },
      reassignOpt,
      policyOpt,
      { text: { type: 'plain_text', text: '🌐  Open in Web App' },           value: `${A.HR_OPEN_WEB}::${caseId}` },
    ],
    ESCALATED: [
      reassignOpt,
      policyOpt,
      { text: { type: 'plain_text', text: '🌐  Open in Web App' }, value: `${A.HR_OPEN_WEB}::${caseId}` },
    ],
  };

  if (state === 'SUBMITTED') {
    return [
      { type: 'button', text: { type: 'plain_text', text: 'Acknowledge' }, style: 'primary', action_id: A.HR_ACKNOWLEDGE, value: caseId },
      { type: 'overflow', action_id: A.HR_OVERFLOW, options: overflowOptionsByState.SUBMITTED },
    ];
  }
  if (state === 'ACKNOWLEDGED') {
    return [
      { type: 'button', text: { type: 'plain_text', text: 'Mark In Review' }, style: 'primary', action_id: A.HR_MARK_REVIEW, value: caseId },
      { type: 'overflow', action_id: A.HR_OVERFLOW, options: overflowOptionsByState.ACKNOWLEDGED },
    ];
  }
  if (state === 'UNDER_REVIEW') {
    return [
      { type: 'button', text: { type: 'plain_text', text: 'Resolve', emoji: true }, style: 'primary', action_id: A.HR_RESOLVE, value: caseId },
      { type: 'overflow', action_id: A.HR_OVERFLOW, options: overflowOptionsByState.UNDER_REVIEW },
    ];
  }
  if (state === 'ESCALATED') {
    return [
      { type: 'button', text: { type: 'plain_text', text: 'Close Case', emoji: true }, style: 'primary', action_id: A.HR_CLOSE, value: caseId },
      { type: 'overflow', action_id: A.HR_OVERFLOW, options: overflowOptionsByState.ESCALATED },
    ];
  }
  return [webBtn];
}

// ── App Home tab ─────────────────────────────────────────────────────────
// Enterprise dashboard surface. Published via views.publish.
// Shows active cases, quick start, and how-it-works.

function homeTabView(cases = []) {
  const blocks = [
    // ── Masthead
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':shield:  *People Action Check*\nConfidential HR guidance before you act. Under 2 minutes.',
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Run a Check', emoji: true },
        style: 'primary',
        action_id: A.SLASH_OPEN_INTAKE,
      },
    },
    { type: 'divider' },
  ];

  // ── Case history
  if (cases.length > 0) {
    blocks.push({ type: 'header', text: { type: 'plain_text', text: 'Recent Checks' } });
    cases.slice(0, 5).forEach(c => {
      const risk = r(c.risk || 'good');
      const date = new Date(c.updatedAt || c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const ref  = c.refName ? `  ·  ${c.refName}` : '  ·  _Self-check_';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${risk.emoji}  *${c.scenario}*${ref}\n${stateLabel(c.state)}  ·  ${date}  ·  \`${c.id}\``,
        },
      });
    });
    if (cases.length > 5) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `+${cases.length - 5} more — open the web app to see all.` }],
      });
    }
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
    callback_id: C.MODAL_HR_REPLY,
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
        block_id: B.HR_MESSAGE,
        label: { type: 'plain_text', text: 'Message' },
        element: {
          type: 'plain_text_input',
          action_id: A.HR_MESSAGE_INPUT,
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
    callback_id: C.MODAL_HR_RESOLVE,
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
        block_id: B.HR_RESOLUTION,
        label: { type: 'plain_text', text: 'Resolution note' },
        element: {
          type: 'plain_text_input',
          action_id: A.HR_RESOLUTION_INPUT,
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
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${scenario}*  ·  \`${caseId}\`\nHR has a question about this case.`,
      },
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
          action_id: A.MGR_REPLY,
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
    callback_id: C.MODAL_MGR_REPLY,
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
        block_id: B.MGR_REPLY,
        label: { type: 'plain_text', text: 'Your reply' },
        element: {
          type: 'plain_text_input',
          action_id: A.MGR_REPLY_INPUT,
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Type your reply to HR…' },
          max_length: 2000,
        },
      },
    ],
  };
}

// ── Case list (DM or Home) ────────────────────────────────────────────────

// ── HR reassign modal ────────────────────────────────────────────────────
// HR picks a new manager via Slack user picker. Only shown for active cases.

function hrReassignModal(caseId, scenario, currentManagerId) {
  return {
    type: 'modal',
    callback_id: C.MODAL_HR_REASSIGN,
    title: { type: 'plain_text', text: 'Reassign Case' },
    submit: { type: 'plain_text', text: 'Reassign' },
    close:  { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ caseId, previousManagerId: currentManagerId }),
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Reassign case \`${caseId}\`*\n_${scenario}_\n\nCurrently assigned to <@${currentManagerId}>. Select the manager who should take over this open case. They will receive a full case summary in a Slack DM.`,
        },
      },
      { type: 'divider' },
      {
        type: 'input',
        block_id: B.NEW_MANAGER,
        label: { type: 'plain_text', text: 'Reassign to' },
        element: {
          type: 'users_select',
          action_id: A.REASSIGN_MANAGER_SELECT,
          placeholder: { type: 'plain_text', text: 'Select a manager…' },
        },
      },
      {
        type: 'input',
        block_id: B.REASSIGN_NOTE,
        optional: true,
        label: { type: 'plain_text', text: 'Note to new manager (optional)' },
        element: {
          type: 'plain_text_input',
          action_id: A.REASSIGN_NOTE_INPUT,
          multiline: false,
          placeholder: { type: 'plain_text', text: 'e.g. "Previous manager left the company — please continue this case."' },
          max_length: 300,
        },
      },
    ],
  };
}

// ── Reassigned case DM ───────────────────────────────────────────────────
// Sent to the new manager when HR reassigns an active case to them.

function caseReassignedDmMessage({ caseId, scenario, level, state, previousManagerId, hrNote }) {
  const risk = r(level);
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${risk.emoji}  *${scenario}*  ·  ${risk.label}\n\`${caseId}\`  ·  Previously held by <@${previousManagerId}>`,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: hrNote
          ? `*Note from HR:* ${hrNote}`
          : `HR has reassigned this case to you. Review the current state and follow up with HR if you need guidance.`,
      },
    },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open Web App', emoji: true },
          action_id: A.RESULT_OPEN_WEB,
          value: caseId,
        },
      ],
    },
  ];
  return {
    text: `Case \`${caseId}\` has been reassigned to you — ${risk.label}: ${scenario}`,
    attachments: [{ color: risk.color, blocks }],
  };
}

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
        action_id: A.RESULT_OPEN_WEB,
        value: caseId,
      },
    },
  ];
}

// ── Export modal ──────────────────────────────────────────────────────────

function exportModal({ isHr = false } = {}) {
  const filterOptions = [
    { text: { type: 'plain_text', text: 'All cases' }, value: 'all' },
    { text: { type: 'plain_text', text: 'HR cases only (notified)' }, value: 'hr' },
    { text: { type: 'plain_text', text: 'Open cases only' }, value: 'open' },
  ];

  // Managers only see their own cases — no filter choice needed
  const blocks = [
    {
      type: 'input',
      block_id: B.EXPORT_FORMAT,
      label: { type: 'plain_text', text: 'Format' },
      element: {
        type: 'static_select',
        action_id: A.EXPORT_FORMAT,
        placeholder: { type: 'plain_text', text: 'Choose a format' },
        options: [
          { text: { type: 'plain_text', text: 'CSV  —  Excel, Google Sheets, Numbers' }, value: 'csv' },
          { text: { type: 'plain_text', text: 'Word doc (.doc)  —  opens in Word' }, value: 'word' },
          { text: { type: 'plain_text', text: 'TSV  —  tab-separated (Excel native)' }, value: 'tsv' },
          { text: { type: 'plain_text', text: 'JSON  —  raw data' }, value: 'json' },
        ],
      },
    },
    ...(isHr ? [{
      type: 'input',
      block_id: B.EXPORT_FILTER,
      label: { type: 'plain_text', text: 'Cases to include' },
      element: {
        type: 'static_select',
        action_id: A.EXPORT_FILTER,
        initial_option: filterOptions[0],
        options: filterOptions,
      },
    }] : []),
    {
      type: 'input',
      block_id: B.EXPORT_DELIVERY,
      label: { type: 'plain_text', text: 'Delivery' },
      element: {
        type: 'static_select',
        action_id: A.EXPORT_DELIVERY,
        placeholder: { type: 'plain_text', text: 'How to receive the file' },
        options: [
          { text: { type: 'plain_text', text: 'Send me a download link' }, value: 'link' },
          { text: { type: 'plain_text', text: 'Email to me' }, value: 'email_self' },
          { text: { type: 'plain_text', text: 'Email to a specific address' }, value: 'email_custom' },
        ],
      },
    },
    {
      type: 'input',
      block_id: B.EXPORT_EMAIL,
      label: { type: 'plain_text', text: 'Email address (if emailing)' },
      optional: true,
      hint: { type: 'plain_text', text: 'For SharePoint: use your document library email address.' },
      element: {
        type: 'plain_text_input',
        action_id: A.EXPORT_EMAIL,
        placeholder: { type: 'plain_text', text: 'hr@company.com or sharepoint-library@company.sharepoint.com' },
      },
    },
  ];

  return {
    type: 'modal',
    callback_id: C.MODAL_EXPORT_CASES,
    private_metadata: isHr ? 'hr' : 'manager',
    title: { type: 'plain_text', text: 'Export Cases' },
    submit: { type: 'plain_text', text: 'Export' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks,
  };
}

// ── HR Policy Library modal ──────────────────────────────────────────────
// HR-only surface. Allows uploading company policy documents (PDF/Word)
// tied to a scenario. Stored in Netlify Blobs under key pac_policies.
// Uploaded files are referenced in scenario guidance for managers.
// Employee identity is never involved — this is admin-level configuration.

function hrPolicyLibraryModal(existingPolicies = []) {
  const policyRows = existingPolicies.length > 0
    ? existingPolicies.map(p => ({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${p.name}*\n_${p.scenario}_  ·  Uploaded ${new Date(p.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Remove' },
          style: 'danger',
          action_id: A.HR_REMOVE_POLICY,
          value: p.id,
          confirm: {
            title: { type: 'plain_text', text: 'Remove policy?' },
            text: { type: 'mrkdwn', text: `Remove *${p.name}* from the policy library?` },
            confirm: { type: 'plain_text', text: 'Remove' },
            deny: { type: 'plain_text', text: 'Keep' },
          },
        },
      }))
    : [{
        type: 'section',
        text: { type: 'mrkdwn', text: '_No policies uploaded yet._' },
      }];

  return {
    type: 'modal',
    callback_id: C.MODAL_POLICY_LIBRARY,
    title: { type: 'plain_text', text: 'Policy Library' },
    submit: { type: 'plain_text', text: 'Save Policy' },
    close:  { type: 'plain_text', text: 'Done' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Upload your company\'s written policies so managers can reference them when running a check. HR admins only.',
        },
      },
      { type: 'divider' },
      {
        type: 'input',
        block_id: B.POLICY_NAME,
        label: { type: 'plain_text', text: 'Policy name' },
        hint: { type: 'plain_text', text: 'e.g. Progressive Discipline Policy, Anti-Harassment Policy' },
        element: {
          type: 'plain_text_input',
          action_id: A.POLICY_NAME_INPUT,
          placeholder: { type: 'plain_text', text: 'Enter a clear, recognizable name' },
          max_length: 120,
        },
      },
      {
        type: 'input',
        block_id: B.POLICY_SCENARIO,
        label: { type: 'plain_text', text: 'Scenario this covers' },
        hint: { type: 'plain_text', text: 'Managers will see this policy linked when they run a check for this scenario.' },
        element: {
          type: 'static_select',
          action_id: A.POLICY_SCENARIO_SELECT,
          placeholder: { type: 'plain_text', text: 'Choose a scenario...' },
          options: [
            ...require('./pac-data').SCENARIO_NAMES.map(s => ({
              text: { type: 'plain_text', text: s },
              value: s,
            })),
            { text: { type: 'plain_text', text: 'All scenarios' }, value: '__all__' },
          ],
        },
      },
      {
        type: 'input',
        block_id: B.POLICY_FILE,
        label: { type: 'plain_text', text: 'Upload file (PDF or Word)' },
        hint: { type: 'plain_text', text: 'Max 10 MB. File is stored securely and referenced by case ID only.' },
        element: {
          type: 'file_input',
          action_id: A.POLICY_FILE,
          filetypes: ['pdf', 'doc', 'docx'],
          max_files: 1,
        },
      },
      { type: 'divider' },
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Current policies' },
      },
      ...policyRows,
    ],
  };
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
  hrReassignModal,
  caseReassignedDmMessage,
  caseListBlocks,
  handoffBlocks,
  exportModal,
  hrPolicyLibraryModal,
};
