// PAC Slack integration — Netlify Function.
// Handles: /pac slash command, block_actions, view_submission.
//
// Environment variables required:
//   PAC_SLACK_BOT_TOKEN      — xoxb-... bot token
//   PAC_SLACK_SIGNING_SECRET — from Slack app Basic Information page
//   PAC_HR_CHANNEL_ID        — Slack channel ID for HR triage messages
//   PAC_ADMIN_TOKEN          — same token used by case-store.js (write auth)
//
// Slash command URL + Interactivity Request URL:
//   https://pachr.netlify.app/api/pac-slack

const crypto = require('crypto');
const { caseStore } = require('./lib/blob-store');
const {
  SCENARIO_QUESTIONS,
} = require('./lib/pac-data');
const {
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
} = require('./lib/pac-blocks');

// ── Constants ────────────────────────────────────────────────────────────

const WEB_APP_URL = 'https://pachr.netlify.app';

const HEADERS = {
  'Content-Type': 'application/json',
};

const CASE_STATES = {
  NOT_STARTED:       'NOT_STARTED',
  IN_PROGRESS_SLACK: 'IN_PROGRESS_SLACK',
  SUBMITTED:         'SUBMITTED',
  ACKNOWLEDGED:      'ACKNOWLEDGED',
  UNDER_REVIEW:      'UNDER_REVIEW',
  ESCALATED:         'ESCALATED',
  CLOSED:            'CLOSED',
};

// ── Helpers ──────────────────────────────────────────────────────────────

function newCaseId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `pac_${ts}_${rand}`;
}

function blobKey(managerId, caseId) {
  return `case/${managerId}/${caseId}`;
}

async function loadCase(managerId, caseId) {
  const store = caseStore();
  const raw = await store.get(blobKey(managerId, caseId));
  return raw ? JSON.parse(raw) : null;
}

async function saveCase(caseRecord) {
  const store = caseStore();
  await store.set(blobKey(caseRecord.managerId, caseRecord.id), JSON.stringify(caseRecord));
}

// Find a case by caseId scanning the manager's blob prefix.
// Used when we have caseId but need to locate managerId.
async function findCaseById(caseId) {
  const store = caseStore();
  const { blobs } = await store.list({ prefix: 'case/' });
  for (const blob of blobs) {
    if (blob.key.endsWith(`/${caseId}`)) {
      const raw = await store.get(blob.key);
      return raw ? JSON.parse(raw) : null;
    }
  }
  return null;
}

async function listCasesForManager(managerId) {
  const store = caseStore();
  const { blobs } = await store.list({ prefix: `case/${managerId}/` });
  const cases = await Promise.all(blobs.map(b => store.get(b.key)));
  return cases.filter(Boolean).map(raw => JSON.parse(raw));
}

function auditEntry(event, actor, meta = {}) {
  return { event, actor, timestamp: new Date().toISOString(), ...meta };
}

// ── Slack API calls ───────────────────────────────────────────────────────

async function slackApi(method, body) {
  const token = process.env.PAC_SLACK_BOT_TOKEN;
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`Slack API ${method} error:`, data.error, JSON.stringify(body).slice(0, 300));
  }
  return data;
}

async function openModal(triggerId, view) {
  return slackApi('views.open', { trigger_id: triggerId, view });
}

async function postMessage(channel, blocks, text = 'People Action Check', opts = {}) {
  return slackApi('chat.postMessage', { channel, blocks, text, ...opts });
}

async function updateMessage(channel, ts, blocks, text = 'People Action Check') {
  return slackApi('chat.update', { channel, ts, blocks, text });
}

async function postEphemeral(channel, userId, blocks, text = 'People Action Check') {
  return slackApi('chat.postEphemeral', { channel, user: userId, blocks, text });
}

// ── Signing secret verification ───────────────────────────────────────────

function verifySignature(event) {
  const secret = process.env.PAC_SLACK_SIGNING_SECRET;
  if (!secret) {
    console.warn('PAC_SLACK_SIGNING_SECRET not set — skipping signature check');
    return true;
  }
  const ts = (event.headers['x-slack-request-timestamp'] || event.headers['X-Slack-Request-Timestamp'] || '');
  const sig = (event.headers['x-slack-signature'] || event.headers['X-Slack-Signature'] || '');
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(ts, 10)) > 300) return false;
  const base = `v0:${ts}:${event.body}`;
  const computed = `v0=${crypto.createHmac('sha256', secret).update(base).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig));
  } catch {
    return false;
  }
}

// ── Request parsing ───────────────────────────────────────────────────────

function parseBody(event) {
  const ct = (event.headers['content-type'] || event.headers['Content-Type'] || '');
  const body = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : (event.body || '');
  if (ct.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(body));
  }
  try { return JSON.parse(body); } catch { return {}; }
}

// ── Slash command handler ─────────────────────────────────────────────────

function handleSlashCommand() {
  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      response_type: 'ephemeral',
      blocks: slashResponseBlocks(),
    }),
  };
}

// ── Block actions router ──────────────────────────────────────────────────

async function handleBlockActions(payload) {
  const action = payload.actions && payload.actions[0];
  if (!action) return ack();

  const actionId = action.action_id;
  const userId   = payload.user && payload.user.id;
  const triggerId = payload.trigger_id;
  const channelId = payload.channel && payload.channel.id;

  // pac_slash_open_intake — open intake modal
  if (actionId === 'pac_slash_open_intake') {
    await openModal(triggerId, intakeModal());
    return ack();
  }

  // pac_slash_list_cases — DM manager their cases
  if (actionId === 'pac_slash_list_cases') {
    const cases = await listCasesForManager(userId);
    cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    await postMessage(userId, caseListBlocks(cases));
    return ack();
  }

  // pac_result_notify_hr — post HR triage message
  if (actionId === 'pac_result_notify_hr') {
    const caseId = action.value;
    const rec = await findCaseById(caseId);
    if (!rec) return ack();

    const hrChannelId = process.env.PAC_HR_CHANNEL_ID;
    if (!hrChannelId) {
      await postEphemeral(channelId || userId, userId, [{
        type: 'section',
        text: { type: 'mrkdwn', text: '⚠️ HR channel not configured. Set `PAC_HR_CHANNEL_ID` in Netlify env vars.' },
      }]);
      return ack();
    }

    const now = new Date().toISOString();
    const msg = await postMessage(
      hrChannelId,
      hrTriageBlocks({
        scenario: rec.scenario,
        level: rec.risk,
        caseId: rec.id,
        managerSlackId: userId,
        submittedAt: now,
        state: CASE_STATES.SUBMITTED,
      }),
      `New PAC submission — ${riskLabel(rec.risk)}`
    );

    // Transition state → SUBMITTED, record HR channel ts for future updates
    const updated = {
      ...rec,
      state: CASE_STATES.SUBMITTED,
      updatedAt: now,
      hrChannelId,
      hrChannelTs: msg.ts,
      hrNotified: true,
      auditLog: [
        ...(rec.auditLog || []),
        auditEntry('HR_NOTIFIED', userId, { hrChannelId, ts: msg.ts }),
      ],
    };
    await saveCase(updated);

    // Update the manager's result DM to show HR was notified
    if (rec.dmTs && rec.dmChannelId) {
      await updateMessage(
        rec.dmChannelId,
        rec.dmTs,
        resultDmBlocks({ scenario: rec.scenario, level: rec.risk, caseId: rec.id, hrNotified: true })
      );
    }

    return ack();
  }

  // pac_result_open_web — ephemeral with web link
  if (actionId === 'pac_result_open_web') {
    const caseId = action.value;
    const url = `${WEB_APP_URL}${caseId ? `?caseId=${caseId}` : ''}`;
    await postEphemeral(channelId || userId, userId, [{
      type: 'section',
      text: { type: 'mrkdwn', text: `Open the web app to continue managing this case:\n${url}` },
    }]);
    return ack();
  }

  // ── HR triage actions ────────────────────────────────────────────────

  if (actionId === 'pac_hr_acknowledge') {
    return handleHrTransition(action.value, userId, CASE_STATES.ACKNOWLEDGED, 'HR_ACKNOWLEDGED');
  }
  if (actionId === 'pac_hr_claim') {
    return handleHrClaim(action.value, userId);
  }
  if (actionId === 'pac_hr_mark_review') {
    return handleHrTransition(action.value, userId, CASE_STATES.UNDER_REVIEW, 'HR_MARKED_REVIEW');
  }
  if (actionId === 'pac_hr_escalate') {
    return handleHrTransition(action.value, userId, CASE_STATES.ESCALATED, 'HR_ESCALATED');
  }
  if (actionId === 'pac_hr_close') {
    return handleHrTransition(action.value, userId, CASE_STATES.CLOSED, 'HR_CLOSED');
  }

  // pac_hr_ask_followup / pac_hr_request_info — open compose modal
  if (actionId === 'pac_hr_ask_followup' || actionId === 'pac_hr_request_info') {
    const title = actionId === 'pac_hr_ask_followup' ? 'Ask Manager a Follow-up' : 'Request More Info';
    await openModal(triggerId, hrReplyModal(action.value, title));
    return ack();
  }

  // pac_hr_resolve — open resolve modal
  if (actionId === 'pac_hr_resolve') {
    await openModal(triggerId, hrResolveModal(action.value));
    return ack();
  }

  // pac_hr_open_web — ephemeral with web link
  if (actionId === 'pac_hr_open_web') {
    const caseId = action.value;
    const url = `${WEB_APP_URL}?caseId=${caseId}`;
    await postEphemeral(channelId || userId, userId, [{
      type: 'section',
      text: { type: 'mrkdwn', text: `Open the web app for full case details:\n${url}` },
    }]);
    return ack();
  }

  // pac_mgr_reply — open manager reply modal
  if (actionId === 'pac_mgr_reply') {
    let caseId, scenario;
    try { ({ caseId, scenario } = JSON.parse(action.value)); } catch { caseId = action.value; scenario = ''; }
    await openModal(triggerId, managerReplyModal(caseId, scenario));
    return ack();
  }

  return ack();
}

// HR state transition helper — updates case + updates HR triage message
async function handleHrTransition(caseId, hrUserId, newState, auditEvent) {
  const rec = await findCaseById(caseId);
  if (!rec) return ack();

  const now = new Date().toISOString();
  const updated = {
    ...rec,
    state: newState,
    updatedAt: now,
    auditLog: [
      ...(rec.auditLog || []),
      auditEntry(auditEvent, hrUserId, { via: 'slack' }),
    ],
  };
  await saveCase(updated);

  // Update HR triage message in place
  if (rec.hrChannelId && rec.hrChannelTs) {
    await updateMessage(
      rec.hrChannelId,
      rec.hrChannelTs,
      hrTriageBlocks({
        scenario: updated.scenario,
        level: updated.risk,
        caseId: updated.id,
        managerSlackId: updated.managerId,
        submittedAt: updated.createdAt,
        state: newState,
        claimedBy: updated.claimedBy || null,
      })
    );
  }

  // Notify manager of state change (if not CLOSED)
  if (newState !== CASE_STATES.CLOSED) {
    const stateMsg = {
      ACKNOWLEDGED: `👀 HR has acknowledged your People Action Check for *${updated.scenario}* (case \`${caseId}\`). They will follow up in Slack.`,
      UNDER_REVIEW: `🔍 HR has marked your case *${updated.scenario}* as Under Review (case \`${caseId}\`).`,
      ESCALATED:    `🚨 Your case *${updated.scenario}* has been escalated for additional review (case \`${caseId}\`).`,
    };
    const msg = stateMsg[newState];
    if (msg) {
      await postMessage(updated.managerId, [{ type: 'section', text: { type: 'mrkdwn', text: msg } }], msg);
    }
  } else {
    const closeMsg = `✅ Your People Action Check for *${updated.scenario}* has been closed by HR (case \`${caseId}\`).`;
    await postMessage(updated.managerId, [{ type: 'section', text: { type: 'mrkdwn', text: closeMsg } }], closeMsg);
  }

  return ack();
}

// HR claim — sets claimedBy
async function handleHrClaim(caseId, hrUserId) {
  const rec = await findCaseById(caseId);
  if (!rec) return ack();

  const now = new Date().toISOString();
  const updated = {
    ...rec,
    state: CASE_STATES.ACKNOWLEDGED,
    claimedBy: hrUserId,
    updatedAt: now,
    auditLog: [
      ...(rec.auditLog || []),
      auditEntry('HR_CLAIMED', hrUserId, { via: 'slack' }),
    ],
  };
  await saveCase(updated);

  if (rec.hrChannelId && rec.hrChannelTs) {
    await updateMessage(
      rec.hrChannelId,
      rec.hrChannelTs,
      hrTriageBlocks({
        scenario: updated.scenario,
        level: updated.risk,
        caseId: updated.id,
        managerSlackId: updated.managerId,
        submittedAt: updated.createdAt,
        state: CASE_STATES.ACKNOWLEDGED,
        claimedBy: hrUserId,
      })
    );
  }

  return ack();
}

// ── View submission router ────────────────────────────────────────────────

async function handleViewSubmission(payload) {
  const callbackId = payload.view && payload.view.callback_id;
  const userId     = payload.user && payload.user.id;
  const values     = payload.view && payload.view.state && payload.view.state.values;

  // pac_modal_intake — push questions modal
  if (callbackId === 'pac_modal_intake') {
    const scenario = values?.pac_block_scenario?.pac_intake_scenario_select?.selected_option?.value;
    const refName  = values?.pac_block_ref_name?.pac_intake_ref_name?.value || '';
    if (!scenario) {
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          response_action: 'errors',
          errors: { pac_block_scenario: 'Please select a scenario.' },
        }),
      };
    }

    const caseId = newCaseId();
    const meta = JSON.stringify({ caseId, scenario, refName, managerId: userId });
    const questions = SCENARIO_QUESTIONS[scenario] || [];

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        response_action: 'push',
        view: questionsModal(scenario, questions, meta),
      }),
    };
  }

  // pac_modal_questions — compute score, save case, DM manager
  if (callbackId === 'pac_modal_questions') {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId, scenario, refName } = meta;
    const questions = SCENARIO_QUESTIONS[scenario] || [];

    // Extract answers from radio buttons
    const answers = questions.map((_, i) => {
      const block = values?.[`pac_block_q_${i}`];
      const sel = block?.[`pac_q_answer_${i}`]?.selected_option?.value;
      return sel || 'unknown';
    });

    // Validate all answered
    const missing = answers.findIndex(a => !a);
    if (missing !== -1) {
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          response_action: 'errors',
          errors: { [`pac_block_q_${missing}`]: 'Please select an answer.' },
        }),
      };
    }

    const { level } = computeScore(questions, answers);
    const now = new Date().toISOString();

    const caseRecord = {
      id: caseId,
      scenario,
      refName,
      managerId: userId,
      source: 'slack',
      state: CASE_STATES.SUBMITTED,
      risk: level,
      answers,
      createdAt: now,
      updatedAt: now,
      followupCount: 0,
      hrNotified: false,
      auditLog: [auditEntry('CASE_CREATED', userId, { scenario, level, source: 'slack' })],
    };

    await saveCase(caseRecord);

    // DM manager with result
    const dmBlocks = resultDmBlocks({ scenario, level, caseId, hrNotified: false });
    const dm = await postMessage(userId, dmBlocks, `PAC Result: ${riskLabel(level)} — ${scenario}`);

    // Store DM ts so we can update "HR notified" state later
    if (dm.ok) {
      const updatedWithDm = {
        ...caseRecord,
        dmTs: dm.ts,
        dmChannelId: dm.channel,
      };
      await saveCase(updatedWithDm);
    }

    // Auto-handoff ephemeral for High Risk
    if (level === 'risk') {
      const dmChannel = dm.channel || userId;
      await postEphemeral(
        dmChannel,
        userId,
        handoffBlocks({ caseId, reason: 'high_risk' })
      );
    }

    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  // pac_modal_hr_reply — HR sends message to manager + posts to thread
  if (callbackId === 'pac_modal_hr_reply') {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId } = meta;
    const message = values?.pac_block_hr_message?.pac_hr_message_input?.value || '';
    const hrUserId = userId;

    const rec = await findCaseById(caseId);
    if (!rec) return ack();

    const now = new Date().toISOString();
    const updated = {
      ...rec,
      followupCount: (rec.followupCount || 0) + 1,
      updatedAt: now,
      auditLog: [
        ...(rec.auditLog || []),
        auditEntry('HR_ASKED_FOLLOWUP', hrUserId, { message: message.slice(0, 200), via: 'slack' }),
      ],
    };
    await saveCase(updated);

    // DM manager with the question + reply button
    await postMessage(
      rec.managerId,
      managerFollowupBlocks({ caseId, scenario: rec.scenario, hrMessage: message, hrSlackId: hrUserId }),
      `HR follow-up on your People Action Check`
    );

    // Post to HR thread as well
    if (rec.hrChannelId && rec.hrChannelTs) {
      await postMessage(
        rec.hrChannelId,
        [{ type: 'section', text: { type: 'mrkdwn', text: `<@${hrUserId}> sent follow-up to manager:\n> ${message}` } }],
        'HR follow-up sent',
        { thread_ts: rec.hrChannelTs }
      );
    }

    // Suggest web handoff if follow-up count ≥ 3
    if (updated.followupCount >= 3 && rec.hrChannelId && rec.hrChannelTs) {
      await postMessage(
        rec.hrChannelId,
        handoffBlocks({ caseId, reason: 'followup' }),
        'Web handoff recommended',
        { thread_ts: rec.hrChannelTs }
      );
    }

    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  // pac_modal_hr_resolve — HR resolves case with note
  if (callbackId === 'pac_modal_hr_resolve') {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId } = meta;
    const note = values?.pac_block_hr_resolution?.pac_hr_resolution_input?.value || '';
    const hrUserId = userId;

    const rec = await findCaseById(caseId);
    if (!rec) return ack();

    const now = new Date().toISOString();
    const updated = {
      ...rec,
      state: CASE_STATES.CLOSED,
      updatedAt: now,
      resolutionNote: note,
      auditLog: [
        ...(rec.auditLog || []),
        auditEntry('HR_RESOLVED', hrUserId, { note: note.slice(0, 200), via: 'slack' }),
      ],
    };
    await saveCase(updated);

    // Update HR triage message
    if (rec.hrChannelId && rec.hrChannelTs) {
      await updateMessage(
        rec.hrChannelId,
        rec.hrChannelTs,
        hrTriageBlocks({
          scenario: updated.scenario,
          level: updated.risk,
          caseId: updated.id,
          managerSlackId: updated.managerId,
          submittedAt: updated.createdAt,
          state: CASE_STATES.CLOSED,
          claimedBy: updated.claimedBy || null,
        })
      );
      // Post resolution note to thread
      await postMessage(
        rec.hrChannelId,
        [{ type: 'section', text: { type: 'mrkdwn', text: `✅ *Resolved by <@${hrUserId}>*\n${note}` } }],
        'Case resolved',
        { thread_ts: rec.hrChannelTs }
      );
    }

    // Notify manager
    const closeMsg = `✅ Your People Action Check for *${updated.scenario}* has been resolved by HR (case \`${caseId}\`).\n\n${note ? `_${note}_` : ''}`;
    await postMessage(
      updated.managerId,
      [{ type: 'section', text: { type: 'mrkdwn', text: closeMsg } }],
      'Case resolved'
    );

    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  // pac_modal_mgr_reply — manager replies to HR
  if (callbackId === 'pac_modal_mgr_reply') {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId, scenario } = meta;
    const reply = values?.pac_block_mgr_reply?.pac_mgr_reply_input?.value || '';
    const managerUserId = userId;

    const rec = await findCaseById(caseId);
    if (!rec) return ack();

    const now = new Date().toISOString();
    const updated = {
      ...rec,
      updatedAt: now,
      auditLog: [
        ...(rec.auditLog || []),
        auditEntry('MGR_REPLIED', managerUserId, { reply: reply.slice(0, 200), via: 'slack' }),
      ],
    };
    await saveCase(updated);

    // Post manager reply to HR thread
    if (rec.hrChannelId && rec.hrChannelTs) {
      await postMessage(
        rec.hrChannelId,
        [{
          type: 'section',
          text: { type: 'mrkdwn', text: `<@${managerUserId}> replied:\n> ${reply}` },
        }],
        'Manager reply',
        { thread_ts: rec.hrChannelTs }
      );
    }

    // Confirm to manager
    await postMessage(
      managerUserId,
      [{ type: 'section', text: { type: 'mrkdwn', text: `✅ Your reply on case \`${caseId}\` has been sent to HR.` } }],
      'Reply sent'
    );

    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  return ack();
}

// ── 200 ack ───────────────────────────────────────────────────────────────

function ack() {
  return { statusCode: 200, headers: HEADERS, body: '' };
}

// ── Main handler ──────────────────────────────────────────────────────────

exports.handler = async function (event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Verify Slack signing secret
  if (!verifySignature(event)) {
    console.error('Slack signature verification failed');
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const parsed = parseBody(event);

  // Slash command
  if (parsed.command === '/pac') {
    return handleSlashCommand();
  }

  // Interactions (block_actions, view_submission)
  if (parsed.payload) {
    let payload;
    try {
      payload = JSON.parse(parsed.payload);
    } catch {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Bad payload' }) };
    }

    if (payload.type === 'block_actions') {
      return handleBlockActions(payload);
    }
    if (payload.type === 'view_submission') {
      return handleViewSubmission(payload);
    }
  }

  return ack();
};
