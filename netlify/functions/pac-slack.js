// PAC Slack integration — Netlify Function.
// Handles: /pac slash command · block_actions · view_submission · event_callback
//
// Environment variables required:
//   PAC_SLACK_BOT_TOKEN      — xoxb-... bot token
//   PAC_SLACK_SIGNING_SECRET — from Slack app Basic Information page
//   PAC_HR_CHANNEL_ID        — Slack channel ID for HR triage messages
//   PAC_ADMIN_TOKEN          — shared with case-store.js (write auth)
//
// Slack app configuration:
//   Slash command URL:         https://pachr.netlify.app/api/pac-slack
//   Interactivity Request URL: https://pachr.netlify.app/api/pac-slack
//   Event Subscriptions URL:   https://pachr.netlify.app/api/pac-slack
//   Required event: app_home_opened
//   Required scopes: commands, chat:write, im:write, views:publish, views:open

const crypto = require('crypto');
const { caseStore } = require('./lib/blob-store');
const { SCENARIO_QUESTIONS } = require('./lib/pac-data');
const {
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
} = require('./lib/pac-blocks');

// ── Constants ─────────────────────────────────────────────────────────────

const WEB_APP_URL = 'https://pachr.netlify.app';

const HEADERS = { 'Content-Type': 'application/json' };

const CASE_STATES = {
  NOT_STARTED:       'NOT_STARTED',
  IN_PROGRESS_SLACK: 'IN_PROGRESS_SLACK',
  SUBMITTED:         'SUBMITTED',
  ACKNOWLEDGED:      'ACKNOWLEDGED',
  UNDER_REVIEW:      'UNDER_REVIEW',
  ESCALATED:         'ESCALATED',
  CLOSED:            'CLOSED',
};

// ── Blob helpers ──────────────────────────────────────────────────────────

function blobKey(managerId, caseId) {
  return `case/${managerId}/${caseId}`;
}

async function loadCase(managerId, caseId) {
  const store = caseStore();
  const raw = await store.get(blobKey(managerId, caseId));
  return raw ? JSON.parse(raw) : null;
}

async function saveCase(rec) {
  const store = caseStore();
  await store.set(blobKey(rec.managerId, rec.id), JSON.stringify(rec));
}

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
  const rows = await Promise.all(blobs.map(b => store.get(b.key)));
  return rows.filter(Boolean).map(raw => JSON.parse(raw));
}

function auditEntry(event, actor, meta = {}) {
  return { event, actor, timestamp: new Date().toISOString(), ...meta };
}

function newCaseId() {
  return `pac_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Slack API ─────────────────────────────────────────────────────────────

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
    console.error(`Slack ${method} error:`, data.error, JSON.stringify(body).slice(0, 200));
  }
  return data;
}

// postMessage accepts either a blocks array OR a pre-built { text, attachments } object
async function postMessage(channel, msgOrBlocks, fallbackText = 'People Action Check', opts = {}) {
  const base = (msgOrBlocks && msgOrBlocks.attachments)
    ? { channel, ...msgOrBlocks, ...opts }
    : { channel, blocks: msgOrBlocks, text: fallbackText, ...opts };
  return slackApi('chat.postMessage', base);
}

async function updateMessage(channel, ts, msgOrBlocks, fallbackText = 'People Action Check') {
  const base = (msgOrBlocks && msgOrBlocks.attachments)
    ? { channel, ts, ...msgOrBlocks }
    : { channel, ts, blocks: msgOrBlocks, text: fallbackText };
  return slackApi('chat.update', base);
}

async function openModal(triggerId, view) {
  return slackApi('views.open', { trigger_id: triggerId, view });
}

async function postEphemeral(channel, userId, blocks, text = 'People Action Check') {
  return slackApi('chat.postEphemeral', { channel, user: userId, blocks, text });
}

async function publishHomeTab(userId) {
  const cases = await listCasesForManager(userId);
  cases.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  return slackApi('views.publish', { user_id: userId, view: homeTabView(cases) });
}

// ── Signing secret ────────────────────────────────────────────────────────

function verifySignature(event) {
  const secret = process.env.PAC_SLACK_SIGNING_SECRET;
  if (!secret) { console.warn('PAC_SLACK_SIGNING_SECRET not set'); return true; }
  const ts  = event.headers['x-slack-request-timestamp'] || event.headers['X-Slack-Request-Timestamp'] || '';
  const sig = event.headers['x-slack-signature']         || event.headers['X-Slack-Signature']         || '';
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(ts, 10)) > 300) return false;
  const computed = `v0=${crypto.createHmac('sha256', secret).update(`v0:${ts}:${event.body}`).digest('hex')}`;
  try { return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig)); } catch { return false; }
}

// ── Body parsing ──────────────────────────────────────────────────────────

function parseBody(event) {
  const ct   = event.headers['content-type'] || event.headers['Content-Type'] || '';
  const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : (event.body || '');
  if (ct.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(body));
  try { return JSON.parse(body); } catch { return {}; }
}

// ── Ack ───────────────────────────────────────────────────────────────────

function ack(body = '') {
  return { statusCode: 200, headers: HEADERS, body: typeof body === 'string' ? body : JSON.stringify(body) };
}

// ── Slash command ─────────────────────────────────────────────────────────

function handleSlashCommand() {
  return ack({ response_type: 'ephemeral', blocks: slashResponseBlocks() });
}

// ── Event callback ────────────────────────────────────────────────────────

async function handleEventCallback(payload) {
  const event = payload.event || {};

  // URL verification challenge
  if (payload.type === 'url_verification') {
    return ack(JSON.stringify({ challenge: payload.challenge }));
  }

  if (event.type === 'app_home_opened' && event.tab === 'home') {
    await publishHomeTab(event.user);
  }

  return ack();
}

// ── Block actions ─────────────────────────────────────────────────────────

async function handleBlockActions(payload) {
  const action    = payload.actions && payload.actions[0];
  if (!action) return ack();

  const actionId  = action.action_id;
  const userId    = payload.user && payload.user.id;
  const triggerId = payload.trigger_id;
  const channelId = payload.channel && payload.channel.id;

  // ── Slash / home actions
  if (actionId === 'pac_slash_open_intake') {
    await openModal(triggerId, intakeModal());
    return ack();
  }

  if (actionId === 'pac_slash_list_cases') {
    const cases = await listCasesForManager(userId);
    cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    await postMessage(userId, caseListBlocks(cases));
    return ack();
  }

  if (actionId === 'pac_result_open_web') {
    const caseId = action.value;
    const url = `${WEB_APP_URL}${caseId ? `?caseId=${encodeURIComponent(caseId)}` : ''}`;
    await postEphemeral(channelId || userId, userId, [{
      type: 'section',
      text: { type: 'mrkdwn', text: `Open the web app to continue:\n${url}` },
    }]);
    return ack();
  }

  // ── Notify HR
  if (actionId === 'pac_result_notify_hr') {
    return handleNotifyHr(action.value, userId, channelId);
  }

  // ── Overflow menu from HR triage — value format: "pac_hr_<action>::<caseId>"
  if (actionId === 'pac_hr_overflow') {
    const [overflowAction, caseId] = (action.selected_option?.value || '').split('::');
    if (!overflowAction || !caseId) return ack();

    if (overflowAction === 'pac_hr_open_web') {
      const url = `${WEB_APP_URL}?caseId=${encodeURIComponent(caseId)}`;
      await postEphemeral(channelId || userId, userId, [{
        type: 'section',
        text: { type: 'mrkdwn', text: `Open the web app for full case details:\n${url}` },
      }]);
      return ack();
    }
    if (overflowAction === 'pac_hr_claim') return handleHrClaim(caseId, userId);
    if (overflowAction === 'pac_hr_ask_followup') {
      await openModal(triggerId, hrReplyModal(caseId, 'Ask Manager a Follow-up'));
      return ack();
    }
    if (overflowAction === 'pac_hr_request_info') {
      await openModal(triggerId, hrReplyModal(caseId, 'Request More Information'));
      return ack();
    }
    if (overflowAction === 'pac_hr_escalate') return handleHrTransition(caseId, userId, CASE_STATES.ESCALATED, 'HR_ESCALATED');
    if (overflowAction === 'pac_hr_close')    return handleHrTransition(caseId, userId, CASE_STATES.CLOSED,    'HR_CLOSED');
    return ack();
  }

  // ── HR triage direct button actions
  if (actionId === 'pac_hr_acknowledge') return handleHrTransition(action.value, userId, CASE_STATES.ACKNOWLEDGED, 'HR_ACKNOWLEDGED');
  if (actionId === 'pac_hr_claim')       return handleHrClaim(action.value, userId);
  if (actionId === 'pac_hr_mark_review') return handleHrTransition(action.value, userId, CASE_STATES.UNDER_REVIEW, 'HR_MARKED_REVIEW');
  if (actionId === 'pac_hr_escalate')    return handleHrTransition(action.value, userId, CASE_STATES.ESCALATED,    'HR_ESCALATED');
  if (actionId === 'pac_hr_close')       return handleHrTransition(action.value, userId, CASE_STATES.CLOSED,       'HR_CLOSED');

  if (actionId === 'pac_hr_ask_followup') {
    await openModal(triggerId, hrReplyModal(action.value, 'Ask Manager a Follow-up'));
    return ack();
  }
  if (actionId === 'pac_hr_request_info') {
    await openModal(triggerId, hrReplyModal(action.value, 'Request More Information'));
    return ack();
  }
  if (actionId === 'pac_hr_resolve') {
    await openModal(triggerId, hrResolveModal(action.value));
    return ack();
  }
  if (actionId === 'pac_hr_open_web') {
    const url = `${WEB_APP_URL}?caseId=${encodeURIComponent(action.value)}`;
    await postEphemeral(channelId || userId, userId, [{
      type: 'section', text: { type: 'mrkdwn', text: `Open the web app for full case details:\n${url}` },
    }]);
    return ack();
  }

  // ── Manager reply
  if (actionId === 'pac_mgr_reply') {
    let caseId, scenario;
    try { ({ caseId, scenario } = JSON.parse(action.value)); } catch { caseId = action.value; scenario = ''; }
    await openModal(triggerId, managerReplyModal(caseId, scenario));
    return ack();
  }

  return ack();
}

// ── HR notify helper ──────────────────────────────────────────────────────

async function handleNotifyHr(caseId, userId, channelId) {
  const rec = await findCaseById(caseId);
  if (!rec) return ack();

  const hrChannelId = process.env.PAC_HR_CHANNEL_ID;
  if (!hrChannelId) {
    await postEphemeral(channelId || userId, userId, [{
      type: 'section',
      text: { type: 'mrkdwn', text: '⚠️  HR channel not configured. Set `PAC_HR_CHANNEL_ID` in Netlify environment variables.' },
    }]);
    return ack();
  }

  const now = new Date().toISOString();
  const msg = await postMessage(
    hrChannelId,
    hrTriageMessage({
      scenario: rec.scenario, level: rec.risk, caseId: rec.id,
      managerSlackId: userId, submittedAt: now, state: CASE_STATES.SUBMITTED,
    })
  );

  const updated = {
    ...rec,
    state: CASE_STATES.SUBMITTED,
    updatedAt: now,
    hrChannelId,
    hrChannelTs: msg.ts,
    hrNotified: true,
    auditLog: [...(rec.auditLog || []), auditEntry('HR_NOTIFIED', userId, { hrChannelId, ts: msg.ts })],
  };
  await saveCase(updated);

  // Update manager's result DM to show HR was notified
  if (rec.dmTs && rec.dmChannelId) {
    await updateMessage(
      rec.dmChannelId, rec.dmTs,
      resultDmMessage({ scenario: rec.scenario, level: rec.risk, caseId: rec.id, hrNotified: true })
    );
  }

  return ack();
}

// ── HR state transition helper ────────────────────────────────────────────

async function handleHrTransition(caseId, hrUserId, newState, auditEvent) {
  const rec = await findCaseById(caseId);
  if (!rec) return ack();

  const now = new Date().toISOString();
  const updated = {
    ...rec,
    state: newState,
    updatedAt: now,
    auditLog: [...(rec.auditLog || []), auditEntry(auditEvent, hrUserId, { via: 'slack' })],
  };
  await saveCase(updated);

  // Update HR triage message in place
  if (rec.hrChannelId && rec.hrChannelTs) {
    await updateMessage(
      rec.hrChannelId, rec.hrChannelTs,
      hrTriageMessage({
        scenario: updated.scenario, level: updated.risk, caseId: updated.id,
        managerSlackId: updated.managerId, submittedAt: updated.createdAt,
        state: newState, claimedBy: updated.claimedBy || null,
      })
    );
  }

  // Notify manager of state change
  const msgs = {
    ACKNOWLEDGED: `👀  HR has acknowledged your People Action Check for *${updated.scenario}* (case \`${caseId}\`). They will follow up in Slack.`,
    UNDER_REVIEW: `🔍  HR has marked your *${updated.scenario}* case under review (case \`${caseId}\`).`,
    ESCALATED:    `🚨  Your *${updated.scenario}* case has been escalated for additional review (case \`${caseId}\`).`,
    CLOSED:       `✅  Your People Action Check for *${updated.scenario}* has been closed by HR (case \`${caseId}\`).`,
  };
  const notifyText = msgs[newState];
  if (notifyText) {
    const risk = r(updated.risk || 'good');
    await postMessage(
      updated.managerId,
      { text: notifyText, attachments: [{ color: risk.color, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: notifyText } }] }] }
    );
  }

  return ack();
}

// ── HR claim ──────────────────────────────────────────────────────────────

async function handleHrClaim(caseId, hrUserId) {
  const rec = await findCaseById(caseId);
  if (!rec) return ack();

  const now = new Date().toISOString();
  const updated = {
    ...rec,
    state: CASE_STATES.ACKNOWLEDGED,
    claimedBy: hrUserId,
    updatedAt: now,
    auditLog: [...(rec.auditLog || []), auditEntry('HR_CLAIMED', hrUserId, { via: 'slack' })],
  };
  await saveCase(updated);

  if (rec.hrChannelId && rec.hrChannelTs) {
    await updateMessage(
      rec.hrChannelId, rec.hrChannelTs,
      hrTriageMessage({
        scenario: updated.scenario, level: updated.risk, caseId: updated.id,
        managerSlackId: updated.managerId, submittedAt: updated.createdAt,
        state: CASE_STATES.ACKNOWLEDGED, claimedBy: hrUserId,
      })
    );
  }

  return ack();
}

// ── View submission ───────────────────────────────────────────────────────

async function handleViewSubmission(payload) {
  const callbackId = payload.view?.callback_id;
  const userId     = payload.user?.id;
  const values     = payload.view?.state?.values;

  // pac_modal_intake → push questions modal
  if (callbackId === 'pac_modal_intake') {
    const scenario = values?.pac_block_scenario?.pac_intake_scenario_select?.selected_option?.value;
    const refName  = values?.pac_block_ref_name?.pac_intake_ref_name?.value || '';
    if (!scenario) {
      return ack({ response_action: 'errors', errors: { pac_block_scenario: 'Please select a scenario.' } });
    }
    const caseId = newCaseId();
    const meta   = JSON.stringify({ caseId, scenario, refName, managerId: userId });
    return ack({ response_action: 'push', view: questionsModal(scenario, SCENARIO_QUESTIONS[scenario] || [], meta) });
  }

  // pac_modal_questions → score, save, DM manager
  if (callbackId === 'pac_modal_questions') {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId, scenario, refName } = meta;
    const questions = SCENARIO_QUESTIONS[scenario] || [];

    const answers = questions.map((_, i) =>
      values?.[`pac_block_q_${i}`]?.[`pac_q_answer_${i}`]?.selected_option?.value || 'unknown'
    );

    const { level } = computeScore(questions, answers);
    const now = new Date().toISOString();

    const caseRecord = {
      id: caseId, scenario, refName,
      managerId: userId, source: 'slack',
      state: CASE_STATES.IN_PROGRESS_SLACK,
      risk: level, answers,
      createdAt: now, updatedAt: now,
      followupCount: 0, hrNotified: false,
      auditLog: [auditEntry('CASE_CREATED', userId, { scenario, level, source: 'slack' })],
    };
    await saveCase(caseRecord);

    const dmMsg = resultDmMessage({ scenario, level, caseId, hrNotified: false });
    const dm    = await postMessage(userId, dmMsg);

    if (dm.ok) {
      await saveCase({ ...caseRecord, dmTs: dm.ts, dmChannelId: dm.channel });
    }

    // Auto-handoff ephemeral for High Risk
    if (level === 'risk') {
      await postEphemeral(dm.channel || userId, userId, handoffBlocks({ caseId, reason: 'high_risk' }));
    }

    // Refresh App Home
    await publishHomeTab(userId);

    return ack('');
  }

  // pac_modal_hr_reply → DM manager + post to HR thread
  if (callbackId === 'pac_modal_hr_reply') {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId } = meta;
    const message = values?.pac_block_hr_message?.pac_hr_message_input?.value || '';

    const rec = await findCaseById(caseId);
    if (!rec) return ack('');

    const now = new Date().toISOString();
    const updated = {
      ...rec,
      followupCount: (rec.followupCount || 0) + 1,
      updatedAt: now,
      auditLog: [...(rec.auditLog || []), auditEntry('HR_ASKED_FOLLOWUP', userId, { message: message.slice(0, 200), via: 'slack' })],
    };
    await saveCase(updated);

    // DM manager
    await postMessage(
      rec.managerId,
      managerFollowupMessage({ caseId, scenario: rec.scenario, hrMessage: message, hrSlackId: userId, level: rec.risk })
    );

    // Thread post to HR channel
    if (rec.hrChannelId && rec.hrChannelTs) {
      await postMessage(
        rec.hrChannelId,
        [{ type: 'section', text: { type: 'mrkdwn', text: `<@${userId}> sent follow-up to manager:\n> ${message}` } }],
        'HR follow-up sent',
        { thread_ts: rec.hrChannelTs }
      );
      if (updated.followupCount >= 3) {
        await postMessage(
          rec.hrChannelId,
          handoffBlocks({ caseId, reason: 'followup' }),
          'Web handoff recommended',
          { thread_ts: rec.hrChannelTs }
        );
      }
    }

    return ack('');
  }

  // pac_modal_hr_resolve → close case with resolution note
  if (callbackId === 'pac_modal_hr_resolve') {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId } = meta;
    const note = values?.pac_block_hr_resolution?.pac_hr_resolution_input?.value || '';

    const rec = await findCaseById(caseId);
    if (!rec) return ack('');

    const now = new Date().toISOString();
    const updated = {
      ...rec,
      state: CASE_STATES.CLOSED,
      resolutionNote: note,
      updatedAt: now,
      auditLog: [...(rec.auditLog || []), auditEntry('HR_RESOLVED', userId, { note: note.slice(0, 200), via: 'slack' })],
    };
    await saveCase(updated);

    if (rec.hrChannelId && rec.hrChannelTs) {
      await updateMessage(
        rec.hrChannelId, rec.hrChannelTs,
        hrTriageMessage({
          scenario: updated.scenario, level: updated.risk, caseId: updated.id,
          managerSlackId: updated.managerId, submittedAt: updated.createdAt,
          state: CASE_STATES.CLOSED, claimedBy: updated.claimedBy || null,
        })
      );
      await postMessage(
        rec.hrChannelId,
        [{ type: 'section', text: { type: 'mrkdwn', text: `✅  *Resolved by <@${userId}>*\n${note}` } }],
        'Case resolved',
        { thread_ts: rec.hrChannelTs }
      );
    }

    const risk = r(updated.risk || 'good');
    const closeText = `✅  Your People Action Check for *${updated.scenario}* has been resolved by HR (case \`${caseId}\`)${note ? `.\n\n_${note}_` : '.'}`;
    await postMessage(
      updated.managerId,
      { text: closeText, attachments: [{ color: risk.color, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: closeText } }] }] }
    );

    return ack('');
  }

  // pac_modal_mgr_reply → post to HR thread + confirm to manager
  if (callbackId === 'pac_modal_mgr_reply') {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId, scenario } = meta;
    const reply = values?.pac_block_mgr_reply?.pac_mgr_reply_input?.value || '';

    const rec = await findCaseById(caseId);
    if (!rec) return ack('');

    const now = new Date().toISOString();
    await saveCase({
      ...rec,
      updatedAt: now,
      auditLog: [...(rec.auditLog || []), auditEntry('MGR_REPLIED', userId, { reply: reply.slice(0, 200), via: 'slack' })],
    });

    if (rec.hrChannelId && rec.hrChannelTs) {
      await postMessage(
        rec.hrChannelId,
        [{ type: 'section', text: { type: 'mrkdwn', text: `<@${userId}> replied:\n> ${reply}` } }],
        'Manager reply',
        { thread_ts: rec.hrChannelTs }
      );
    }

    await postMessage(userId, [{
      type: 'section',
      text: { type: 'mrkdwn', text: `✅  Your reply on case \`${caseId}\` has been sent to HR.` },
    }]);

    return ack('');
  }

  return ack('');
}

// ── Main handler ──────────────────────────────────────────────────────────

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!verifySignature(event)) {
    console.error('Slack signature verification failed');
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const parsed = parseBody(event);

  // URL verification (Events API)
  if (parsed.type === 'url_verification') {
    return ack(JSON.stringify({ challenge: parsed.challenge }));
  }

  // Slash command
  if (parsed.command === '/pac') return handleSlashCommand();

  // Event callback (app_home_opened, etc.)
  if (parsed.type === 'event_callback') return handleEventCallback(parsed);

  // Interactions
  if (parsed.payload) {
    let payload;
    try { payload = JSON.parse(parsed.payload); } catch {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Bad payload' }) };
    }
    if (payload.type === 'block_actions')   return handleBlockActions(payload);
    if (payload.type === 'view_submission') return handleViewSubmission(payload);
  }

  return ack();
};
