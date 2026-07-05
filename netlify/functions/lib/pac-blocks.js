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

const { SCENARIO_NAMES, NEXT_STEPS, SCENARIO_META } = require('./pac-data');
const { ACTION_IDS: A, BLOCK_IDS: B, CALLBACK_IDS: C } = require('./governance');

// -- Risk system ----------------------------------------------------------

const RISK = {
  good: { color: '#34d399', emoji: '🟢', label: 'Low Risk',      dot: '●' },
  warn: { color: '#f59e0b', emoji: '🟡', label: 'Elevated Risk', dot: '●' },
  risk: { color: '#f43f5e', emoji: '🔴', label: 'High Risk',     dot: '●' },
};

function r(level) { return RISK[level] || RISK.good; }

const STATE_LABELS = {
  NOT_STARTED:       '○  Not Started',
  IN_PROGRESS_SLACK: 'In Progress',
  SUBMITTED:         '📥  Submitted',
  ACKNOWLEDGED:      '👀  Acknowledged',
  UNDER_REVIEW:      '🔍  Under Review',
  ESCALATED:         '🚨  Escalated',
  CLOSED:            '✅  Closed',
  ARCHIVED:          '📁  Archived',
};

function stateLabel(state) { return STATE_LABELS[state] || state; }

// -- Scoring --------------------------------------------------------------
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

// -- Slash command ephemeral ----------------------------------------------

function slashResponseBlocks() {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'People Action Check', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'A structured risk check before you take action on an employee situation. Under 2 minutes. Leave the reference blank for a private self-check — add a note and HR is automatically notified when you finish.',
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Start a Check', emoji: true },
        style: 'primary',
        action_id: A.SLASH_OPEN_INTAKE,
      },
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
          text: { type: 'plain_text', text: 'HR Cases', emoji: true },
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

// -- Intake modal ---------------------------------------------------------

function intakeModal(preSelectedScenario = null) {
  const scenarioElement = {
    type: 'multi_static_select',
    action_id: A.INTAKE_SCENARIO,
    placeholder: { type: 'plain_text', text: 'Choose a situation...' },
    options: SCENARIO_NAMES.map(s => {
      const m = SCENARIO_META[s] || {};
      const label = `${m.emoji || ''} ${s}  —  ${m.riskLabel || 'Moderate Risk'}`;
      return { text: { type: 'plain_text', text: label }, value: s };
    }),
    ...(preSelectedScenario ? {
      initial_options: [(() => {
        const m = SCENARIO_META[preSelectedScenario] || {};
        const label = `${m.emoji || ''} ${preSelectedScenario}  —  ${m.riskLabel || 'Moderate Risk'}`;
        return { text: { type: 'plain_text', text: label }, value: preSelectedScenario };
      })()],
    } : {}),
  };

  const headerBlocks = preSelectedScenario
    ? (() => {
        const m = SCENARIO_META[preSelectedScenario] || {};
        const blocks = [
          {
            type: 'header',
            text: { type: 'plain_text', text: `${m.emoji || '📋'}  ${preSelectedScenario}`, emoji: true },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `*${m.riskLabel || 'Moderate Risk'}*  ·  ${m.description || ''}` }],
          },
        ];
        if (m.examples?.length) {
          blocks.push({ type: 'divider' });
          blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*COMMON EXAMPLES*' } });
          blocks.push({ type: 'section', text: { type: 'mrkdwn', text: m.examples.map(e => `→  ${e}`).join('\n') } });
        }
        if (m.docGuidance?.length) {
          blocks.push({ type: 'divider' });
          blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*DOCUMENTATION GUIDANCE*' } });
          blocks.push({ type: 'section', text: { type: 'mrkdwn', text: m.docGuidance.map((g, i) => `*${i + 1}.*  ${g}`).join('\n') } });
        }
        if (m.watch) {
          blocks.push({ type: 'divider' });
          blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `⚠️  *Watch for:* ${m.watch}` }] });
        }
        if (m.contactHR) {
          blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `📞  *Not sure? Contact HR:* ${m.contactHR}` }] });
        }
        blocks.push({ type: 'divider' });
        return blocks;
      })()
    : [];

  return {
    type: 'modal',
    callback_id: C.MODAL_INTAKE,
    title: { type: 'plain_text', text: 'New Check' },
    submit: { type: 'plain_text', text: 'Continue' },
    close:  { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: B.SCENARIO,
        label: { type: 'plain_text', text: 'Choose one or multiple scenarios' },
        hint: { type: 'plain_text', text: 'Select every scenario that applies. Questions come from the first scenario you pick.' },
        element: scenarioElement,
      },
      { type: 'divider' },
      {
        type: 'input',
        block_id: B.REF_NAME,
        optional: true,
        label: { type: 'plain_text', text: 'Employee name or reference (optional)' },
        hint: { type: 'plain_text', text: 'Enter initials or a short reference. If filled in, HR is notified when you finish. Leave blank to keep private.' },
        element: {
          type: 'plain_text_input',
          action_id: A.INTAKE_REF_NAME,
          placeholder: { type: 'plain_text', text: 'e.g. J. Mitchell' },
          max_length: 80,
        },
      },
      ...headerBlocks,
    ],
  };
}

// -- Questions modal ------------------------------------------------------

function questionsModal(scenario, questions, privateMetadata) {
  const criticalCount = questions.filter(q => q.critical).length;

  const blocks = [];

  // -- Questions header
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `*QUESTIONS*\nAnswer based on what you know right now. Honest answers give you a useful result.` },
  });

  if (criticalCount > 0) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `⚠️  ${criticalCount} critical question${criticalCount > 1 ? 's' : ''} in this set — answering No or Not sure on any of them raises the result to High Risk.` }],
    });
  }

  blocks.push({ type: 'divider' });

  questions.forEach((q, i) => {
    blocks.push({
      type: 'input',
      block_id: `${B.Q_PREFIX}${i}`,
      label: { type: 'plain_text', text: `${i + 1}. ${q.q}${q.critical ? '  ⚠️' : ''}` },
      ...(q.hint ? {
        hint: { type: 'plain_text', text: q.critical
          ? `${q.hint}  Critical — No or Don't know raises this to High Risk.`
          : q.hint },
      } : q.critical ? {
        hint: { type: 'plain_text', text: 'Critical — No or Don\'t know raises this to High Risk.' },
      } : {}),
      element: {
        type: 'radio_buttons',
        action_id: `${A.Q_ANSWER_PREFIX}${i}`,
        focus_on_load: false,
        options: [
          { text: { type: 'plain_text', text: 'Yes'      }, value: 'yes'     },
          { text: { type: 'plain_text', text: 'No'       }, value: 'no'      },
          { text: { type: 'plain_text', text: 'Not sure' }, value: 'unknown' },
        ],
      },
    });
  });

  return {
    type: 'modal',
    callback_id: C.MODAL_QUESTIONS,
    title: { type: 'plain_text', text: scenario.length <= 24 ? scenario : scenario.slice(0, 23) + '…' },
    submit: { type: 'plain_text', text: 'See Result' },
    close:  { type: 'plain_text', text: 'Back' },
    private_metadata: privateMetadata,
    blocks,
  };
}

// -- Result DM to manager -------------------------------------------------
// Returns { text, attachments } for chat.postMessage.
// Uses colored left border to signal risk level visually.
// Includes next steps so the DM is immediately actionable.

const SCENARIO_CAUTION = {
  'Performance Decline':        'If you are unsure whether the performance issue is connected to a medical condition, disability, leave, or a recent complaint — stop and contact HR before doing anything else.',
  'Attendance Issue':           'If any absences may be covered by FMLA, ADA, state leave, or another protected reason — confirm with HR before issuing any discipline.',
  'Termination Consideration':  'If the employee has raised a complaint, requested accommodation, or is on or recently returned from leave — stop and get HR clearance first.',
  'Retaliation Concern':        'Any adverse action that follows protected activity carries significant legal risk. Confirm your rationale with HR and employment counsel before proceeding.',
  'Harassment / Discrimination':'If any party has filed or may file a complaint — stop and escalate to HR today. Do not attempt to resolve this informally.',
  'Leave of Absence':           'Do not take any action related to attendance or performance while protected leave status is unconfirmed.',
};

function resultDmMessage({ scenario, scenarios = [scenario], level, caseId, hrNotified = false, followupCount = 0, refName = '', answers = [], questions = [] }) {
  const selfCheck = !refName;
  const risk = r(level);
  const steps = NEXT_STEPS[scenario] || {};
  const stepList = steps[level === 'good' ? 'good' : level === 'warn' ? 'warn' : 'risk'] || [];

  const otherScenarios = scenarios.length > 1
    ? `\n_Also flagged: ${scenarios.slice(1).join(', ')}_`
    : '';

  const statusLine = selfCheck
    ? '🔒  Private self-check'
    : hrNotified
    ? '✅  Sent to HR'
    : '⏳  Awaiting HR';

  const riskHeader = level === 'risk'
    ? '🔴  HIGH RISK — Stop. HR clearance required before any action.'
    : level === 'warn'
    ? '🟡  ELEVATED RISK — Consult HR before you proceed.'
    : '🟢  LOW RISK — Routine management action — proceed carefully.';

  const guidanceDetail = level === 'risk'
    ? 'Do not schedule meetings, issue warnings, or communicate with the employee until HR has reviewed this case.'
    : level === 'warn'
    ? 'Address the documentation gaps below and confirm your next move with HR first.'
    : 'Your answers indicate this situation is within standard management scope. Document each step you take.';

  const blocks = [
    // -- Header: scenario + status
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${scenario}*${otherScenarios}\n${statusLine}  ·  \`${caseId}\``,
      },
    },
    { type: 'divider' },

    // -- Risk level + guidance
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${riskHeader}*\n${guidanceDetail}`,
      },
    },
  ];

  // -- Recommended next steps
  if (stepList.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*RECOMMENDED NEXT STEPS*\n${stepList.map((s, i) => `*${i + 1}*   ${s}`).join('\n\n')}`,
      },
    });
  }

  // -- "Still not sure?" caution (scenario-specific)
  const caution = SCENARIO_CAUTION[scenario];
  if (caution && level !== 'risk') {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `⚠️  *Still not sure?*  ${caution}` }],
    });
  }

  // -- Scenario meta for ALL selected scenarios
  scenarios.forEach((s, idx) => {
    const meta = SCENARIO_META[s];
    if (!meta) return;
    blocks.push({ type: 'divider' });
    const label = scenarios.length > 1 ? ` (${idx + 1} of ${scenarios.length})` : '';
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${meta.emoji || '📋'}  ${s.toUpperCase()}${label}*\n${meta.riskLabel || ''}  ·  ${meta.description || ''}` },
    });
    if (meta.examples?.length > 0) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*COMMON EXAMPLES*\n${meta.examples.map(e => `→  ${e}`).join('\n')}` },
      });
    }
    if (meta.docGuidance?.length > 0) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*DOCUMENTATION GUIDANCE*\n${meta.docGuidance.map((g, i) => `*${i + 1}.*  ${g}`).join('\n')}` },
      });
    }
    if (meta.watch)     blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `⚠️  *Watch for:* ${meta.watch}` }] });
    if (meta.contactHR) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `📞  *Not sure? Contact HR:* ${meta.contactHR}` }] });
  });

  // -- Questions with selected answers in order
  if (answers.length > 0 && questions.length > 0) {
    const answerLabel = { yes: '✅  Yes', no: '❌  No', unknown: '❓  Not sure' };
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*YOUR ANSWERS*\n${questions.map((q, i) => {
          const label = answerLabel[answers[i]] || answers[i];
          const critical = q.critical ? '  ⚠️' : '';
          return `*${i + 1}.*${critical}  ${q.q}\n      ${label}`;
        }).join('\n\n')}`,
      },
    });
  }

  blocks.push({ type: 'divider' });

  // -- HR status + primary actions
  if (selfCheck) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '🔒  Saved to your private history. HR has not been notified and cannot be without a case reference.' }],
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
      elements: [{ type: 'mrkdwn', text: '✅  Sent to HR — they will follow up in Slack. You can message HR below at any time.' }],
    });
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '💬  Message HR', emoji: true },
          style: 'primary',
          action_id: A.MGR_REPLY,
          value: JSON.stringify({ caseId, scenario }),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Attach Files', emoji: true },
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
    // Back-compat: refName set but HR not yet notified (edge case from old flow)
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Send to HR', emoji: true },
          style: level === 'risk' ? 'danger' : 'primary',
          action_id: A.RESULT_NOTIFY_HR,
          value: caseId,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Attach Files', emoji: true },
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

  // -- Secondary row: run again, email report, 30-day reminder (reminder only for HR cases)
  const secondaryElements = [
    {
      type: 'button',
      text: { type: 'plain_text', text: '↩  Run Again', emoji: true },
      action_id: A.SLASH_OPEN_INTAKE,
    },
    {
      type: 'button',
      text: { type: 'plain_text', text: '✉  Email Report', emoji: true },
      action_id: A.RESULT_EMAIL_SELF,
      value: caseId,
    },
  ];
  if (!selfCheck) {
    secondaryElements.push({
      type: 'button',
      text: { type: 'plain_text', text: '📅  Set 30-Day Reminder', emoji: true },
      action_id: A.RESULT_SET_FOLLOWUP,
      value: caseId,
    });
  }
  blocks.push({ type: 'actions', elements: secondaryElements });

  // -- Web handoff callout for high risk / many follow-ups
  if ((level === 'risk' || followupCount >= 3) && hrNotified) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Full case history, documents, and HR audit log available in the web app.*`,
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

// -- HR triage message ----------------------------------------------------
// Posted to PAC_HR_CHANNEL_ID. Employee identity NEVER included.
// Uses colored border + overflow menu for secondary actions.

function hrTriageMessage({ scenario, scenarios = [scenario], level, caseId, managerSlackId, submittedAt, state = 'SUBMITTED', claimedBy = null, answers = [], questions = [], attachments = [], refName = '' }) {
  const risk = r(level);
  const meta = SCENARIO_META[scenario] || {};
  const date = new Date(submittedAt).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const blocks = [
    // -- Case header
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${risk.emoji}  *${scenario}*  ·  *${risk.label}*\n<@${managerSlackId}>  ·  ${date} ET  ·  \`${caseId}\`  ·  ${stateLabel(state)}${refName ? `  ·  Ref: ${refName}` : ''}`,
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

  // -- Full Q&A
  if (questions.length > 0) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*MANAGER\'S ANSWERS*' } });
    const ansLabel = { yes: '✅  Yes', no: '❌  No', unknown: '❓  Not sure' };
    questions.forEach((q, i) => {
      const ans = answers[i];
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${i + 1}.${q.critical ? '  ⚠️' : ''}  ${q.q}*\n${ansLabel[ans] || '_No answer_'}`,
        },
      });
    });
    const yesCount = answers.filter(a => a === 'yes').length;
    const noCount  = answers.filter(a => a === 'no').length;
    const unkCount = answers.filter(a => a === 'unknown').length;
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `✅  ${yesCount} Yes   ❌  ${noCount} No   ❓  ${unkCount} Not sure` }],
    });
    blocks.push({ type: 'divider' });
  }

  // -- Uploaded documents
  if (attachments.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*UPLOADED DOCUMENTS*\n${attachments.map(a => `📎  <${a.permalink}|${a.name}>`).join('\n')}`,
      },
    });
    blocks.push({ type: 'divider' });
  }

  // -- Scenario guidance for ALL selected scenarios
  scenarios.forEach((s, idx) => {
    const sm = SCENARIO_META[s];
    if (!sm) return;
    const label = scenarios.length > 1 ? ` (${idx + 1} of ${scenarios.length})` : '';
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${sm.emoji || '📋'}  ${s.toUpperCase()}${label}*  ·  ${sm.riskLabel || ''}` },
    });
    if (sm.watch)     blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `⚠️  *Watch for:* ${sm.watch}` }] });
    if (sm.contactHR) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `📞  *Contact HR guidance:* ${sm.contactHR}` }] });
  });
  blocks.push({ type: 'divider' });

  if (claimedBy) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Claimed by <@${claimedBy}>` }],
    });
  }

  // -- Actions
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

  const msgManagerBtn = {
    type: 'button',
    text: { type: 'plain_text', text: '💬  Message Manager', emoji: true },
    action_id: A.HR_ASK_FOLLOWUP,
    value: caseId,
  };

  if (state === 'SUBMITTED') {
    return [
      { type: 'button', text: { type: 'plain_text', text: 'Acknowledge' }, style: 'primary', action_id: A.HR_ACKNOWLEDGE, value: caseId },
      msgManagerBtn,
      { type: 'overflow', action_id: A.HR_OVERFLOW, options: overflowOptionsByState.SUBMITTED },
    ];
  }
  if (state === 'ACKNOWLEDGED') {
    return [
      { type: 'button', text: { type: 'plain_text', text: 'Mark In Review' }, style: 'primary', action_id: A.HR_MARK_REVIEW, value: caseId },
      msgManagerBtn,
      { type: 'overflow', action_id: A.HR_OVERFLOW, options: overflowOptionsByState.ACKNOWLEDGED },
    ];
  }
  if (state === 'UNDER_REVIEW') {
    return [
      { type: 'button', text: { type: 'plain_text', text: 'Resolve', emoji: true }, style: 'primary', action_id: A.HR_RESOLVE, value: caseId },
      msgManagerBtn,
      { type: 'overflow', action_id: A.HR_OVERFLOW, options: overflowOptionsByState.UNDER_REVIEW },
    ];
  }
  if (state === 'ESCALATED') {
    return [
      { type: 'button', text: { type: 'plain_text', text: 'Close Case', emoji: true }, style: 'primary', action_id: A.HR_CLOSE, value: caseId },
      msgManagerBtn,
      { type: 'overflow', action_id: A.HR_OVERFLOW, options: overflowOptionsByState.ESCALATED },
    ];
  }
  return [webBtn];
}

// -- App Home tab ---------------------------------------------------------
// Enterprise dashboard surface. Published via views.publish.
// Shows active cases, quick start, and how-it-works.

function homeTabView(cases = []) {
  const blocks = [
    // -- Masthead
    {
      type: 'header',
      text: { type: 'plain_text', text: '🛡️  People Action Check', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'A structured HR risk check before you act on an employee situation. Get a risk level (Low / Elevated / High) and recommended next steps in under 2 minutes.\n\n*To start a check, pick the scenario that best fits your situation from the list below.*',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Company Policies for Your Guidance', emoji: true },
          action_id: A.SLASH_OPEN_POLICIES,
          style: 'primary',
        },
      ],
    },
    { type: 'divider' },
    // -- How to use
    {
      type: 'header',
      text: { type: 'plain_text', text: 'How to Use', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*1.*  Pick the scenario below that matches your situation — that opens the check.\n*2.*  Add a reference (optional) — initials or a short note. Leave blank = private self-check. Add a note and HR is automatically notified when you finish.\n*3.*  Answer 4–6 questions honestly. Your answers determine the risk level.\n*4.*  Get your result with next steps, documentation guidance, and options to attach files or email a copy to yourself.\n\n_⚠️  General HR guidance only — not legal advice. For High Risk situations or formal complaints, contact HR directly._',
      },
    },
    { type: 'divider' },
  ];

  // -- Scenario cards — each is its own entry point
  blocks.push({ type: 'header', text: { type: 'plain_text', text: 'Select a Scenario to Start a Check', emoji: true } });
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: 'Tap the scenario that best fits your situation. Each one opens a tailored check with its own questions, examples, and documentation guidance.' }],
  });

  SCENARIO_NAMES.forEach(name => {
    const meta = SCENARIO_META[name] || {};
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${meta.emoji || '📋'}  *${name}*  ·  _${meta.riskLabel || 'Moderate Risk'}_\n${meta.description ? meta.description.split('.')[0] + '.' : ''}`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Start Check', emoji: true },
        action_id: A.SLASH_OPEN_SCENARIO,
        value: name,
      },
    });
  });

  blocks.push({ type: 'divider' });

  // -- Session history (bottom)
  const today = new Date().toISOString().slice(0, 10);

  // Follow-up reminders first if any are due
  const followups = cases.filter(c => c.followupDate && c.followupDate <= today && c.state !== 'CLOSED' && c.state !== 'ARCHIVED');
  if (followups.length > 0) {
    blocks.push({ type: 'header', text: { type: 'plain_text', text: '📅  Follow-up Reminders Due', emoji: true } });
    followups.forEach(c => {
      const risk = r(c.risk || 'good');
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${risk.emoji}  *${c.scenario}*${c.refName ? `  ·  ${c.refName}` : ''}\nSet for ${c.followupDate}  ·  \`${c.id}\``,
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'View Case', emoji: true },
          action_id: A.SLASH_VIEW_CASE,
          value: c.id,
        },
      });
    });
    blocks.push({ type: 'divider' });
  }

  // Session history
  blocks.push({ type: 'header', text: { type: 'plain_text', text: '📂  Your Session History', emoji: true } });
  if (cases.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '_No checks yet. Pick a scenario above to start your first one._' },
    });
  } else {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: 'All your checks are saved here — including questions, answers, and any documents you uploaded. Click View to see the full record or export it.' }],
    });
    cases.forEach(c => {
      const risk = r(c.risk || 'good');
      const date = new Date(c.updatedAt || c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const ref  = c.refName ? `  ·  ${c.refName}` : '  ·  _Private self-check_';
      const docsNote = c.attachments?.length ? `  ·  📎 ${c.attachments.length} file${c.attachments.length > 1 ? 's' : ''}` : '';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${risk.emoji}  *${c.scenario}*${ref}\n${stateLabel(c.state)}  ·  ${date}${docsNote}  ·  \`${c.id}\``,
        },
      });
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View in Slack', emoji: true },
            action_id: A.SLASH_VIEW_CASE,
            value: c.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open Web App', emoji: true },
            action_id: A.RESULT_OPEN_WEB,
            value: c.id,
          },
        ],
      });
    });
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'My Cases', emoji: true },
        action_id: A.SLASH_LIST_CASES,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Export', emoji: true },
        action_id: A.SLASH_EXPORT_CASES,
      },
    ],
  });
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: 'People Action Check  ·  General guidance only — not legal advice.' }],
  });

  return { type: 'home', blocks };
}

// -- HR compose modal -----------------------------------------------------

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

// -- HR resolve modal -----------------------------------------------------

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

// -- Manager follow-up DM -------------------------------------------------

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

// -- Manager reply modal --------------------------------------------------

function managerReplyModal(caseId, scenario) {
  return {
    type: 'modal',
    callback_id: C.MODAL_MGR_REPLY,
    title: { type: 'plain_text', text: 'Message HR' },
    submit: { type: 'plain_text', text: 'Send' },
    close:  { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ caseId, scenario }),
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${scenario}*  ·  Case \`${caseId}\`\nYour message goes directly to the HR team — not visible to anyone else.` },
      },
      { type: 'divider' },
      {
        type: 'input',
        block_id: B.MGR_REPLY,
        label: { type: 'plain_text', text: 'Your message' },
        hint: { type: 'plain_text', text: 'HR will receive this in Slack and by email. You can share updates, ask questions, or provide additional context.' },
        element: {
          type: 'plain_text_input',
          action_id: A.MGR_REPLY_INPUT,
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Type your message to HR…' },
          max_length: 2000,
        },
      },
    ],
  };
}

// -- Case list (DM or Home) ------------------------------------------------

// -- HR reassign modal ----------------------------------------------------
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

// -- Reassigned case DM ---------------------------------------------------
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

// -- Handoff ---------------------------------------------------------------

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

// -- Export modal ----------------------------------------------------------

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
          ...(isHr ? [{ text: { type: 'plain_text', text: 'Post file to HR Slack channel' }, value: 'slack_channel' }] : []),
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

// -- HR Policy Library modal ----------------------------------------------
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

// -- Manager document upload modal ----------------------------------------
// existingDocs: array of { name, permalink } already attached to the case.

function uploadDocModal(caseId, existingDocs = []) {
  const existingSection = existingDocs.length > 0
    ? [
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Already attached (${existingDocs.length}):*\n` +
              existingDocs.map(f => `• <${f.permalink}|${f.name}>`).join('\n'),
          },
        },
      ]
    : [];

  return {
    type: 'modal',
    callback_id: C.MODAL_UPLOAD_DOC,
    title: { type: 'plain_text', text: 'Attach Documents' },
    submit: { type: 'plain_text', text: 'Attach to Case' },
    close:  { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ caseId }),
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Case \`${caseId}\`* — attach supporting documentation`,
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: 'PIPs, write-ups, emails, or any supporting file. Any file type accepted. If HR has been notified, they will receive these documents.' }],
      },
      { type: 'divider' },
      {
        type: 'input',
        block_id: B.DOC_UPLOAD,
        label: { type: 'plain_text', text: 'Files' },
        element: {
          type: 'file_input',
          action_id: A.DOC_FILES,
          max_files: 10,
        },
      },
      ...existingSection,
    ],
  };
}

// -- Case full export message ---------------------------------------------
// Sent as a DM to the manager when they click View on a session history entry.
// Contains everything: scenario info, risk, Q&A, next steps, docs, case ID.

function caseFullExportMessage(rec, questions) {
  const risk       = r(rec.risk || 'good');
  const meta       = SCENARIO_META[rec.scenario] || {};
  const date       = new Date(rec.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const answers    = rec.answers || [];
  const nextSteps  = (NEXT_STEPS[rec.scenario] || {})[rec.risk || 'good'] || [];
  const attachments = rec.attachments || [];

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `${meta.emoji || '📋'}  ${rec.scenario}`, emoji: true } },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*Case ID:*  \`${rec.id}\``,
          `*Date:*  ${date}`,
          `*Risk Level:*  ${risk.emoji}  *${risk.label.toUpperCase()}*`,
          rec.refName ? `*Reference:*  ${rec.refName}` : `*Type:*  Private self-check`,
          `*Status:*  ${stateLabel(rec.state)}`,
          rec.hrNotified ? `*HR Notified:*  ✅  Yes` : `*HR Notified:*  No`,
        ].join('\n'),
      },
    },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: `*ABOUT THIS SCENARIO*\n${meta.description || ''}` } },
  ];

  // Q&A
  if (questions?.length) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*YOUR ANSWERS*' } });
    const ansLabel = { yes: '✅  Yes', no: '❌  No', unknown: '❓  Not sure' };
    questions.forEach((q, i) => {
      const ans = answers[i];
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${i + 1}.${q.critical ? '  ⚠️' : ''}  ${q.q}*\n${ansLabel[ans] || '—'}${q.hint ? `\n_${q.hint}_` : ''}`,
        },
      });
    });
    const yesCount = answers.filter(a => a === 'yes').length;
    const noCount  = answers.filter(a => a === 'no').length;
    const unkCount = answers.filter(a => a === 'unknown').length;
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `✅  ${yesCount} Yes   ❌  ${noCount} No   ❓  ${unkCount} Not sure` }],
    });
  }

  // Next steps
  if (nextSteps.length) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*RECOMMENDED NEXT STEPS*\n${nextSteps.map((s, i) => `*${i + 1}.*  ${s}`).join('\n')}` } });
  }

  // Documentation guidance
  if (meta.docGuidance?.length) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*DOCUMENTATION GUIDANCE*\n${meta.docGuidance.map((g, i) => `*${i + 1}.*  ${g}`).join('\n')}` } });
  }

  // Watch for / Contact HR
  if (meta.watch || meta.contactHR) {
    blocks.push({ type: 'divider' });
    if (meta.watch)    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `⚠️  *Watch for:* ${meta.watch}` }] });
    if (meta.contactHR) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `📞  *Not sure? Contact HR:* ${meta.contactHR}` }] });
  }

  // Uploaded documents
  if (attachments.length) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*UPLOADED DOCUMENTS*\n${attachments.map(a => `📎  <${a.permalink}|${a.name}>`).join('\n')}` } });
  } else {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: '📎  No documents uploaded for this case.' }] });
  }

  // Export action
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '✉  Email This to Me', emoji: true },
        action_id: A.RESULT_EMAIL_SELF,
        value: rec.id,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: '📎  Attach Files', emoji: true },
        action_id: A.RESULT_UPLOAD_DOC,
        value: rec.id,
      },
    ],
  });
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `Case exported  ·  ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}  ·  People Action Check` }],
  });

  return { text: `Case export: ${rec.scenario} — ${rec.id}`, blocks };
}

function resultModal({ scenario, level, caseId, refName, steps = [] }) {
  const risk = r(level);
  const selfCheck = !refName;
  const header = level === 'risk'
    ? '🔴  HIGH RISK — Stop. HR clearance required before any action.'
    : level === 'warn'
    ? '🟡  ELEVATED RISK — Consult HR before you proceed.'
    : '🟢  LOW RISK — Routine management action. Document each step.';

  const blocks = [
    { type: 'section', text: { type: 'mrkdwn', text: `*${header}*` } },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: `*Scenario:* ${scenario}\n*Case ID:* \`${caseId}\`${refName ? `\n*Reference:* ${refName}` : '\n_Private self-check — HR not notified_'}` } },
  ];

  if (steps.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*RECOMMENDED NEXT STEPS*\n${steps.map((s, i) => `*${i + 1}.*  ${s}`).join('\n')}` } });
  }

  blocks.push({ type: 'divider' });
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `📩  Full result sent to you via DM — includes your answers, documentation guidance, and next steps.` }] });

  return {
    type: 'modal',
    callback_id: 'pac_modal_result',
    title: { type: 'plain_text', text: 'Your Result' },
    close: { type: 'plain_text', text: 'Close' },
    blocks,
  };
}

module.exports = {
  computeScore,
  r,
  stateLabel,
  slashResponseBlocks,
  intakeModal,
  questionsModal,
  resultModal,
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
  uploadDocModal,
  caseFullExportMessage,
};
// deploy Sat Jul  4 07:45:16 EDT 2026
