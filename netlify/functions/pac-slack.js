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
//   Slash command URL:         https://peopleactioncheck.netlify.app/api/pac-slack
//   Interactivity Request URL: https://peopleactioncheck.netlify.app/api/pac-slack
//   Event Subscriptions URL:   https://peopleactioncheck.netlify.app/api/pac-slack
//   Required event: app_home_opened
//   Required scopes: commands, chat:write, im:write, views:publish, views:open, users:read, users:read.email, files:read

const crypto = require('crypto');
const dataStore = require('./lib/data-store');
const { SCENARIO_QUESTIONS, SCENARIO_META, NEXT_STEPS } = require('./lib/pac-data');
const {
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
  caseFullExportMessage,
  handoffBlocks,
  exportModal,
  hrPolicyLibraryModal,
  uploadDocModal,
} = require('./lib/pac-blocks');

const { hrConfigStore } = require('./lib/blob-store');
const emailNotify = require('./lib/email-notify');
const { ACTION_IDS: A, CALLBACK_IDS: C, BLOCK_IDS: B, AUDIT_EVENTS: E } = require('./lib/governance');

async function getHrEmail() {
  const store = hrConfigStore();
  return (await store.get('hrEmail')) || '';
}

// ── Policy library helpers ────────────────────────────────────────────────
// Policies stored in Netlify Blobs under key 'pac_policies' as a JSON array.
// Each entry: { id, name, scenario, fileId, fileName, uploadedAt, uploadedBy }

async function loadPolicies() {
  try {
    const store = hrConfigStore();
    const raw = await store.get('pac_policies');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function savePolicy(entry) {
  const store = hrConfigStore();
  const existing = await loadPolicies();
  existing.push(entry);
  await store.set('pac_policies', JSON.stringify(existing));
}

async function removePolicy(policyId) {
  const store = hrConfigStore();
  const existing = await loadPolicies();
  await store.set('pac_policies', JSON.stringify(existing.filter(p => p.id !== policyId)));
}

// ── Slack modal update helper ─────────────────────────────────────────────

async function updateModal(viewId, view) {
  if (!viewId) return;
  await slackApi('views.update', { view_id: viewId, view });
}

// Look up a Slack user's email address (requires users:read.email scope)
async function getSlackUserEmail(userId) {
  try {
    const res = await slackApi('users.info', { user: userId });
    return res.user?.profile?.email || '';
  } catch { return ''; }
}

// ── Constants ─────────────────────────────────────────────────────────────

const WEB_APP_URL = 'https://peopleactioncheck.netlify.app';

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

// ── Data store helpers (backend selected by PAC_DATA_STORE env var) ──────

const { getCase, saveCase, findCaseById, listCasesForManager, listAllCases } = dataStore;

function auditEntry(event, actor, meta = {}) {
  return { event, actor, timestamp: new Date().toISOString(), ...meta };
}

function newCaseId() {
  return `pac_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Slack API ─────────────────────────────────────────────────────────────

async function slackApi(method, body) {
  const token = activeToken || process.env.PAC_SLACK_BOT_TOKEN;
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

// Upload a text/CSV file natively to a Slack channel using files.getUploadURLExternal + files.completeUploadExternal
async function uploadFileToChannel(channel, filename, content, initialComment = '') {
  const token = activeToken || process.env.PAC_SLACK_BOT_TOKEN;
  if (!token) return null;

  try {
    // Step 1: get an upload URL
    const urlRes = await fetch('https://slack.com/api/files.getUploadURLExternal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filename, length: Buffer.byteLength(content, 'utf8') }),
    });
    const urlData = await urlRes.json();
    if (!urlData.ok) { console.error('files.getUploadURLExternal error:', urlData.error); return null; }

    // Step 2: PUT the file content
    await fetch(urlData.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: content,
    });

    // Step 3: complete the upload and share to channel
    const completeRes = await fetch('https://slack.com/api/files.completeUploadExternal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        files: [{ id: urlData.file_id }],
        channel_id: channel,
        initial_comment: initialComment,
      }),
    });
    const completeData = await completeRes.json();
    if (!completeData.ok) console.error('files.completeUploadExternal error:', completeData.error);
    return completeData;
  } catch (e) {
    console.error('uploadFileToChannel error:', e.message);
    return null;
  }
}

async function publishHomeTab(userId, activeResult = null) {
  const cases = await listCasesForManager(userId);
  cases.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  return slackApi('views.publish', { user_id: userId, view: homeTabView(cases, activeResult) });
}

// ── Multi-workspace token resolution ─────────────────────────────────────
// When PAC_CONSULTING_SIGNING_SECRET is set, we support two workspaces.
// verifySignature returns 'hr' | 'consulting' | false.
// activeToken is set per-request so slackApi uses the right bot token.

let activeToken = null;

function tryVerify(secret, ts, sig, rawBody) {
  if (!secret) return false;
  const computed = `v0=${crypto.createHmac('sha256', secret).update(`v0:${ts}:${rawBody}`).digest('hex')}`;
  try { return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig)); } catch { return false; }
}

function verifySignature(event) {
  const ts  = event.headers['x-slack-request-timestamp'] || event.headers['X-Slack-Request-Timestamp'] || '';
  const sig = event.headers['x-slack-signature']         || event.headers['X-Slack-Signature']         || '';
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(ts, 10)) > 300) return false;
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : (event.body || '');

  const hrSecret = process.env.PAC_SLACK_SIGNING_SECRET;
  const consultSecret = process.env.PAC_CONSULTING_SIGNING_SECRET;

  if (!hrSecret && !consultSecret) { console.warn('No signing secret set'); activeToken = process.env.PAC_SLACK_BOT_TOKEN; return true; }

  if (tryVerify(hrSecret, ts, sig, rawBody)) {
    activeToken = process.env.PAC_SLACK_BOT_TOKEN;
    return true;
  }
  if (tryVerify(consultSecret, ts, sig, rawBody)) {
    activeToken = process.env.PAC_CONSULTING_BOT_TOKEN || process.env.PAC_SLACK_BOT_TOKEN;
    return true;
  }
  return false;
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
  return ack({ response_type: 'ephemeral', blocks: slashResponseBlocks(), text: 'People Action Check' });
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
  if (actionId === A.SLASH_OPEN_INTAKE) {
    await openModal(triggerId, intakeModal());
    return ack();
  }

  if (actionId === A.SLASH_OPEN_SCENARIO) {
    const scenario = action.value;
    await openModal(triggerId, intakeModal(scenario));
    return ack();
  }

  if (actionId === A.SLASH_OPEN_POLICIES) {
    const store = hrConfigStore();
    const existing = (await store.get('pac_policies', { type: 'json' })) || [];
    await openModal(triggerId, hrPolicyLibraryModal(existing));
    return ack();
  }

  if (actionId === A.SLASH_VIEW_CASE) {
    const caseId = action.value;
    const rec = await findCaseById(caseId);
    if (!rec || rec.managerId !== userId) return ack();
    const questions = SCENARIO_QUESTIONS[rec.scenario] || [];
    await postMessage(userId, caseFullExportMessage(rec, questions));
    return ack();
  }

  if (actionId === A.SLASH_LIST_CASES) {
    const cases = await listCasesForManager(userId);
    cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    await postMessage(userId, caseListBlocks(cases));
    return ack();
  }

  if (actionId === A.SLASH_EXPORT_CASES) {
    // Determine if this is an HR user (has HR channel config) or manager
    const hrEmail = await getHrEmail().catch(() => null);
    const isHr = !!hrEmail; // rough heuristic — HR user if HR email is configured
    await openModal(triggerId, exportModal({ isHr }));
    return ack();
  }

  if (actionId === A.SLASH_HR_CASES) {
    const all = await listAllCases();
    const hrCases = all
      .filter(c => c.hrNotified)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    if (!hrCases.length) {
      await postMessage(userId, [{
        type: 'section',
        text: { type: 'mrkdwn', text: '*HR Cases*\nNo cases have been submitted to HR yet.' },
      }]);
    } else {
      const blocks = [
        { type: 'header', text: { type: 'plain_text', text: 'HR Cases' } },
        { type: 'divider' },
        ...hrCases.slice(0, 10).flatMap(c => {
          const risk = r(c.risk || 'good');
          const date = new Date(c.updatedAt || c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const docs  = (c.attachments || []).length;
          const docNote = docs > 0 ? `  ·  📎 ${docs} doc${docs > 1 ? 's' : ''}` : '';
          return [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${risk.emoji}  *${c.scenario}*  ·  <@${c.managerId}>\n${stateLabel(c.state)}  ·  ${date}  ·  \`${c.id}\`${docNote}`,
            },
            accessory: {
              type: 'overflow',
              action_id: A.HR_CASE_ROW_OVERFLOW,
              options: [
                { text: { type: 'plain_text', text: 'Filter by this manager' }, value: `${A.CASE_ROW_FILTER_MGR}::${c.managerId}` },
                { text: { type: 'plain_text', text: 'Open case thread'       }, value: `open_case::${c.id}` },
              ],
            },
          }];
        }),
        ...(hrCases.length > 10 ? [{ type: 'context', elements: [{ type: 'mrkdwn', text: `+${hrCases.length - 10} more — open the web app to see all.` }] }] : []),
      ];
      await postMessage(userId, blocks);
    }
    return ack();
  }

  if (actionId === A.HR_CASE_ROW_OVERFLOW) {
    const [action, value] = (action?.selected_option?.value || '').split('::');
    if (action === A.CASE_ROW_FILTER_MGR && value) {
      const all = await listAllCases();
      const mgrCases = all
        .filter(c => c.managerId === value && c.hrNotified)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      const label = mgrCases.length ? `Cases from <@${value}>` : `No HR cases from <@${value}>`;
      const rows = mgrCases.map(c => {
        const risk = r(c.risk || 'good');
        const date = new Date(c.updatedAt || c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { type: 'section', text: { type: 'mrkdwn', text: `${risk.emoji}  *${c.scenario}*  ·  ${stateLabel(c.state)}  ·  ${date}  ·  \`${c.id}\`` } };
      });
      await postMessage(userId, [
        { type: 'header', text: { type: 'plain_text', text: label } },
        { type: 'divider' },
        ...rows,
      ]);
    }
    if (action === 'open_case' && value) {
      const rec = await findCaseById(value);
      if (rec?.hrChannelId && rec?.hrChannelTs) {
        const link = `https://slack.com/archives/${rec.hrChannelId}/p${rec.hrChannelTs.replace('.', '')}`;
        await postEphemeral(channelId || userId, userId, [{
          type: 'section',
          text: { type: 'mrkdwn', text: `Open the HR thread for case \`${value}\`:\n${link}` },
        }]);
      }
    }
    return ack();
  }

  if (actionId === A.RESULT_OPEN_WEB) {
    const caseId = action.value;
    const url = `${WEB_APP_URL}${caseId ? `?caseId=${encodeURIComponent(caseId)}` : ''}`;
    await postEphemeral(channelId || userId, userId, [{
      type: 'section',
      text: { type: 'mrkdwn', text: `Open the web app to continue:\n${url}` },
    }]);
    return ack();
  }

  // ── Notify HR
  if (actionId === A.RESULT_NOTIFY_HR) {
    return handleNotifyHr(action.value, userId, channelId);
  }

  // ── Upload documentation (opens modal with file_input)
  if (actionId === A.RESULT_UPLOAD_DOC) {
    const caseId = action.value;
    const rec = await findCaseById(caseId);
    const existingDocs = (rec?.attachments || []).map(f => ({ name: f.name, permalink: f.url }));
    await openModal(payload.trigger_id, uploadDocModal(caseId, existingDocs));
    return ack();
  }

  // ── Email report to self
  if (actionId === A.RESULT_EMAIL_SELF) {
    const caseId = action.value;
    const rec = await findCaseById(caseId);
    if (rec) {
      getSlackUserEmail(userId).then(email =>
        emailNotify.notifyManagerResult({
          managerEmail: email, scenario: rec.scenario, level: rec.risk,
          caseId: rec.id, refName: rec.refName || '', selfCheck: !rec.refName,
        })
      ).catch(() => {});
    }
    await postEphemeral(channelId || userId, userId, [
      { type: 'section', text: { type: 'mrkdwn', text: `✉️  Your People Action Check report for case \`${caseId}\` is on its way to your inbox.` } },
    ]);
    return ack();
  }

  // ── Set 30-day follow-up reminder
  if (actionId === A.RESULT_SET_FOLLOWUP) {
    const caseId = action.value;
    const rec = await findCaseById(caseId);
    if (rec) {
      const followupDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await saveCase({ ...rec, followupDate, updatedAt: new Date().toISOString() });
      await postEphemeral(channelId || userId, userId, [
        { type: 'section', text: { type: 'mrkdwn', text: `📅  30-day reminder saved for *${followupDate}*. It will appear on your People Action Check home screen.` } },
      ]);
    }
    return ack();
  }

  // ── Overflow menu from HR triage — value format: "pac_hr_<action>::<caseId>"
  if (actionId === A.HR_OVERFLOW) {
    const [overflowAction, caseId] = (action.selected_option?.value || '').split('::');
    if (!overflowAction || !caseId) return ack();

    if (overflowAction === A.HR_OPEN_WEB) {
      const url = `${WEB_APP_URL}?caseId=${encodeURIComponent(caseId)}`;
      await postEphemeral(channelId || userId, userId, [{
        type: 'section',
        text: { type: 'mrkdwn', text: `Open the web app for full case details:\n${url}` },
      }]);
      return ack();
    }
    if (overflowAction === A.HR_CLAIM) return handleHrClaim(caseId, userId);
    if (overflowAction === A.HR_ASK_FOLLOWUP) {
      await openModal(triggerId, hrReplyModal(caseId, 'Ask Manager a Follow-up'));
      return ack();
    }
    if (overflowAction === A.HR_REQUEST_INFO) {
      await openModal(triggerId, hrReplyModal(caseId, 'Request More Information'));
      return ack();
    }
    if (overflowAction === A.HR_ESCALATE) return handleHrTransition(caseId, userId, CASE_STATES.ESCALATED, E.HR_ESCALATED);
    if (overflowAction === A.HR_CLOSE)    return handleHrTransition(caseId, userId, CASE_STATES.CLOSED,    E.HR_CLOSED);
    if (overflowAction === A.HR_REASSIGN) {
      const rec = await findCaseById(caseId);
      if (!rec) return ack();
      await openModal(payload.trigger_id, hrReassignModal(caseId, rec.scenario, rec.managerId));
      return ack();
    }
    if (overflowAction === A.HR_POLICY_LIBRARY) {
      const existing = await loadPolicies();
      await openModal(triggerId, hrPolicyLibraryModal(existing));
      return ack();
    }
    return ack();
  }

  // HR policy library direct button
  if (actionId === A.HR_REMOVE_POLICY) {
    const policyId = action.value;
    await removePolicy(policyId);
    const existing = await loadPolicies();
    await updateModal(payload.view?.id, hrPolicyLibraryModal(existing));
    return ack();
  }

  // ── HR triage direct button actions
  if (actionId === A.HR_ACKNOWLEDGE) return handleHrTransition(action.value, userId, CASE_STATES.ACKNOWLEDGED, E.HR_ACKNOWLEDGED);
  if (actionId === A.HR_CLAIM)       return handleHrClaim(action.value, userId);
  if (actionId === A.HR_MARK_REVIEW) return handleHrTransition(action.value, userId, CASE_STATES.UNDER_REVIEW, E.HR_MARKED_REVIEW);
  if (actionId === A.HR_ESCALATE)    return handleHrTransition(action.value, userId, CASE_STATES.ESCALATED,    E.HR_ESCALATED);
  if (actionId === A.HR_CLOSE)       return handleHrTransition(action.value, userId, CASE_STATES.CLOSED,       E.HR_CLOSED);

  if (actionId === A.HR_ASK_FOLLOWUP) {
    await openModal(triggerId, hrReplyModal(action.value, 'Ask Manager a Follow-up'));
    return ack();
  }
  if (actionId === A.HR_REQUEST_INFO) {
    await openModal(triggerId, hrReplyModal(action.value, 'Request More Information'));
    return ack();
  }
  if (actionId === A.HR_RESOLVE) {
    await openModal(triggerId, hrResolveModal(action.value));
    return ack();
  }
  if (actionId === A.HR_OPEN_WEB) {
    const url = `${WEB_APP_URL}?caseId=${encodeURIComponent(action.value)}`;
    await postEphemeral(channelId || userId, userId, [{
      type: 'section', text: { type: 'mrkdwn', text: `Open the web app for full case details:\n${url}` },
    }]);
    return ack();
  }

  // ── Manager reply
  if (actionId === A.MGR_REPLY) {
    let caseId, scenario;
    try { ({ caseId, scenario } = JSON.parse(action.value)); } catch { caseId = action.value; scenario = ''; }
    await openModal(triggerId, managerReplyModal(caseId, scenario));
    return ack();
  }

  return ack();
}

// ── HR notify helper ──────────────────────────────────────────────────────

// Core HR notification logic — shared by manual "Send to HR" and auto-notify on check completion.
async function notifyHrCore(caseId, userId) {
  const rec = await findCaseById(caseId);
  if (!rec) return;

  const hrChannelId = process.env.PAC_HR_CHANNEL_ID;
  if (!hrChannelId) return;

  const now = new Date().toISOString();
  const questions   = SCENARIO_QUESTIONS[rec.scenario] || [];
  const attachments = rec.attachments || [];

  const msg = await postMessage(
    hrChannelId,
    hrTriageMessage({
      scenario: rec.scenario, level: rec.risk, caseId: rec.id,
      managerSlackId: userId, submittedAt: now, state: CASE_STATES.SUBMITTED,
      answers: rec.answers || [], questions, attachments, refName: rec.refName || '',
    })
  );

  const updated = {
    ...rec,
    state: CASE_STATES.SUBMITTED,
    updatedAt: now,
    hrChannelId,
    hrChannelTs: msg.ts,
    hrNotified: true,
    auditLog: [...(rec.auditLog || []), auditEntry(E.HR_NOTIFIED, userId, { hrChannelId, ts: msg.ts })],
  };
  await saveCase(updated);

  // Update manager DM to show HR notified state
  if (rec.dmTs && rec.dmChannelId) {
    await updateMessage(
      rec.dmChannelId, rec.dmTs,
      resultDmMessage({ scenario: rec.scenario, level: rec.risk, caseId: rec.id, hrNotified: true, refName: rec.refName || '', answers: rec.answers || [], questions })
    );
  }

  // Email HR with full Q&A, next steps, and file links (fire-and-forget)
  getHrEmail().then(hrEmail =>
    emailNotify.notifyHrOfCase({
      hrEmail, scenario: rec.scenario, level: rec.risk,
      caseId: rec.id, managerSlackId: userId,
      answers: rec.answers || [], questions,
      fileRefs: attachments,
      refName: rec.refName || '',
    })
  ).catch(() => {});
}

async function handleNotifyHr(caseId, userId, channelId) {
  const hrChannelId = process.env.PAC_HR_CHANNEL_ID;
  if (!hrChannelId) {
    await postEphemeral(channelId || userId, userId, [{
      type: 'section',
      text: { type: 'mrkdwn', text: '⚠️  HR channel not configured. Set `PAC_HR_CHANNEL_ID` in Netlify environment variables.' },
    }]);
    return ack();
  }
  await notifyHrCore(caseId, userId);
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
    const qs = SCENARIO_QUESTIONS[updated.scenario] || [];
    await updateMessage(
      rec.hrChannelId, rec.hrChannelTs,
      hrTriageMessage({
        scenario: updated.scenario, level: updated.risk, caseId: updated.id,
        managerSlackId: updated.managerId, submittedAt: updated.createdAt,
        state: newState, claimedBy: updated.claimedBy || null,
        answers: updated.answers || [], questions: qs,
        attachments: updated.attachments || [], refName: updated.refName || '',
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
    auditLog: [...(rec.auditLog || []), auditEntry(E.HR_CLAIMED, hrUserId, { via: 'slack' })],
  };
  await saveCase(updated);

  if (rec.hrChannelId && rec.hrChannelTs) {
    const qs = SCENARIO_QUESTIONS[updated.scenario] || [];
    await updateMessage(
      rec.hrChannelId, rec.hrChannelTs,
      hrTriageMessage({
        scenario: updated.scenario, level: updated.risk, caseId: updated.id,
        managerSlackId: updated.managerId, submittedAt: updated.createdAt,
        state: CASE_STATES.ACKNOWLEDGED, claimedBy: hrUserId,
        answers: updated.answers || [], questions: qs,
        attachments: updated.attachments || [], refName: updated.refName || '',
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
  if (callbackId === C.MODAL_INTAKE) {
    const selectedOptions = values?.[B.SCENARIO]?.[A.INTAKE_SCENARIO]?.selected_options || [];
    const scenarios = selectedOptions.map(o => o.value);
    const scenario  = scenarios[0]; // primary — drives questions and scoring
    const refName   = values?.[B.REF_NAME]?.[A.INTAKE_REF_NAME]?.value || '';
    if (!scenario) {
      return ack({ response_action: 'errors', errors: { [B.SCENARIO]: 'Please select at least one scenario.' } });
    }
    const caseId = newCaseId();
    const meta   = JSON.stringify({ caseId, scenario, scenarios, refName, managerId: userId });
    return ack({ response_action: 'push', view: questionsModal(scenario, SCENARIO_QUESTIONS[scenario] || [], meta) });
  }

  // pac_modal_questions → score, save, DM manager
  if (callbackId === C.MODAL_QUESTIONS) {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId, scenario, scenarios = [scenario], refName } = meta;
    const questions = SCENARIO_QUESTIONS[scenario] || [];

    const answers = questions.map((_, i) =>
      values?.[`${B.Q_PREFIX}${i}`]?.[`${A.Q_ANSWER_PREFIX}${i}`]?.selected_option?.value || 'unknown'
    );

    const { level } = computeScore(questions, answers);
    const steps = (NEXT_STEPS[scenario] || {})[level === 'good' ? 'good' : level === 'warn' ? 'warn' : 'risk'] || [];

    const now = new Date().toISOString();
    const autoNotify = !!refName;
    const caseRecord = {
      id: caseId, scenario, scenarios, refName,
      managerId: userId, source: 'slack',
      state: CASE_STATES.IN_PROGRESS_SLACK,
      risk: level, answers,
      createdAt: now, updatedAt: now,
      followupCount: 0, hrNotified: false,
      auditLog: [auditEntry(E.CASE_CREATED, userId, { scenario, scenarios, level, source: 'slack' })],
    };

    (async () => {
      // Publish result to App Home FIRST — user lands there immediately after clear ack
      try { await publishHomeTab(userId, { scenario, level, caseId, refName: refName || '', steps }); }
      catch (e) { console.error('publishHomeTab error:', e); }

      // Background: save, DM, HR notify
      try {
        await saveCase(caseRecord);
        const dmMsg = resultDmMessage({ scenario, scenarios, level, caseId, hrNotified: autoNotify, refName: refName || '', answers, questions });
        const dm = await postMessage(userId, dmMsg);
        if (dm.ok) await saveCase({ ...caseRecord, dmTs: dm.ts, dmChannelId: dm.channel });
        if (autoNotify) { try { await notifyHrCore(caseId, userId); } catch {} }
        getSlackUserEmail(userId).then(email =>
          emailNotify.notifyManagerResult({ managerEmail: email, scenario, level, caseId, refName: refName || '', selfCheck: !refName })
        ).catch(() => {});
        if (level === 'risk') await postEphemeral(dm.channel || userId, userId, handoffBlocks({ caseId, reason: 'high_risk' }));
        // Refresh App Home again once case is saved (updates session history)
        publishHomeTab(userId).catch(() => {});
      } catch (e) { console.error('MODAL_QUESTIONS background error:', e); }
    })();

    // Clear all modals immediately — user lands on App Home which shows the result banner
    return ack({ response_action: 'clear' });
  }

  // pac_modal_hr_reply → DM manager + post to HR thread
  if (callbackId === C.MODAL_HR_REPLY) {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId } = meta;
    const message = values?.[B.HR_MESSAGE]?.[A.HR_MESSAGE_INPUT]?.value || '';

    const rec = await findCaseById(caseId);
    if (!rec) return ack('');

    const now = new Date().toISOString();
    const updated = {
      ...rec,
      followupCount: (rec.followupCount || 0) + 1,
      updatedAt: now,
      auditLog: [...(rec.auditLog || []), auditEntry(E.HR_ASKED_FOLLOWUP, userId, { message: message.slice(0, 200), via: 'slack' })],
    };
    await saveCase(updated);

    // DM manager
    await postMessage(
      rec.managerId,
      managerFollowupMessage({ caseId, scenario: rec.scenario, hrMessage: message, hrSlackId: userId, level: rec.risk })
    );

    // Email manager (fire-and-forget)
    getSlackUserEmail(rec.managerId).then(managerEmail =>
      emailNotify.notifyManagerOfHrReply({ managerEmail, caseId, scenario: rec.scenario, message })
    ).catch(() => {});

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
  if (callbackId === C.MODAL_HR_RESOLVE) {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId } = meta;
    const note = values?.[B.HR_RESOLUTION]?.[A.HR_RESOLUTION_INPUT]?.value || '';

    const rec = await findCaseById(caseId);
    if (!rec) return ack('');

    const now = new Date().toISOString();
    const updated = {
      ...rec,
      state: CASE_STATES.CLOSED,
      resolutionNote: note,
      updatedAt: now,
      auditLog: [...(rec.auditLog || []), auditEntry(E.HR_RESOLVED, userId, { note: note.slice(0, 200), via: 'slack' })],
    };
    await saveCase(updated);

    if (rec.hrChannelId && rec.hrChannelTs) {
      await updateMessage(
        rec.hrChannelId, rec.hrChannelTs,
        hrTriageMessage({
          scenario: updated.scenario, level: updated.risk, caseId: updated.id,
          managerSlackId: updated.managerId, submittedAt: updated.createdAt,
          state: CASE_STATES.CLOSED, claimedBy: updated.claimedBy || null,
          answers: updated.answers || [], questions: SCENARIO_QUESTIONS[updated.scenario] || [],
          attachments: updated.attachments || [], refName: updated.refName || '',
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
  if (callbackId === C.MODAL_MGR_REPLY) {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId, scenario } = meta;
    const reply = values?.[B.MGR_REPLY]?.[A.MGR_REPLY_INPUT]?.value || '';

    const rec = await findCaseById(caseId);
    if (!rec) return ack('');

    const now = new Date().toISOString();
    await saveCase({
      ...rec,
      updatedAt: now,
      auditLog: [...(rec.auditLog || []), auditEntry(E.MGR_REPLIED, userId, { reply: reply.slice(0, 200), via: 'slack' })],
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

    // Email HR with manager's reply (fire-and-forget)
    getHrEmail().then(hrEmail =>
      emailNotify.notifyHrOfManagerReply({ hrEmail, caseId, scenario: rec.scenario, message: reply })
    ).catch(() => {});

    return ack('');
  }

  // pac_modal_upload_doc → store file references + notify HR thread
  if (callbackId === C.MODAL_UPLOAD_DOC) {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId } = meta;

    // Slack sends uploaded files as an array of file objects on the view
    const uploadedFiles = payload.view?.state?.values?.[B.DOC_UPLOAD]?.[A.DOC_FILES]?.files || [];

    const rec = await findCaseById(caseId);
    if (!rec) return ack('');

    const now = new Date().toISOString();
    const fileRefs = uploadedFiles.map(f => ({
      id:       f.id,
      name:     f.name,
      mimetype: f.mimetype,
      url:      f.permalink,
      uploadedAt: now,
      uploadedBy: userId,
    }));

    await saveCase({
      ...rec,
      updatedAt: now,
      attachments: [...(rec.attachments || []), ...fileRefs],
      auditLog: [...(rec.auditLog || []), auditEntry(E.DOCS_UPLOADED, userId, { count: fileRefs.length, files: fileRefs.map(f => f.name) })],
    });

    // Notify HR thread with file links (files referenced by permalink per governance — not raw attached)
    if (rec.hrNotified && rec.hrChannelId && rec.hrChannelTs && fileRefs.length > 0) {
      const fileLinks = fileRefs.map(f => `• <${f.url}|${f.name}>`).join('\n');
      await postMessage(
        rec.hrChannelId,
        [{
          type: 'section',
          text: { type: 'mrkdwn', text: `📎  Manager added ${fileRefs.length} document${fileRefs.length > 1 ? 's' : ''} to case \`${caseId}\`:\n${fileLinks}` },
        }],
        'Documents uploaded',
        { thread_ts: rec.hrChannelTs }
      );
    }

    // Confirm to manager
    const hrNotice = rec.hrNotified ? ' HR has been notified and will receive these documents.' : '';
    const confirmText = fileRefs.length > 0
      ? `✅  ${fileRefs.length} file${fileRefs.length > 1 ? 's' : ''} attached to case \`${caseId}\`.${hrNotice}`
      : `No files were attached to case \`${caseId}\`.`;

    await postMessage(userId, [{ type: 'section', text: { type: 'mrkdwn', text: confirmText } }]);

    // Email both parties with uploaded docs as attachments (fire-and-forget)
    if (fileRefs.length > 0) {
      Promise.all([getSlackUserEmail(userId), getHrEmail()]).then(([managerEmail, hrEmail]) =>
        emailNotify.notifyDocumentUploaded({
          managerEmail, hrEmail,
          caseId, scenario: rec.scenario, fileRefs, uploaderLabel: 'Manager',
        })
      ).catch(() => {});
    }

    return ack('');
  }

  // pac_modal_hr_reassign → update managerId, DM new manager, notify HR thread
  if (callbackId === C.MODAL_HR_REASSIGN) {
    let meta = {};
    try { meta = JSON.parse(payload.view.private_metadata || '{}'); } catch {}
    const { caseId, previousManagerId } = meta;
    const newManagerId = values?.[B.NEW_MANAGER]?.[A.REASSIGN_MANAGER_SELECT]?.selected_user;
    const note = values?.[B.REASSIGN_NOTE]?.[A.REASSIGN_NOTE_INPUT]?.value || '';

    if (!newManagerId) return ack('');

    const rec = await findCaseById(caseId);
    if (!rec) return ack('');

    const now = new Date().toISOString();
    const updated = {
      ...rec,
      managerId: newManagerId,
      updatedAt: now,
      auditLog: [...(rec.auditLog || []), auditEntry(E.CASE_REASSIGNED, userId, {
        previousManagerId, newManagerId, note: note.slice(0, 200),
      })],
    };
    await saveCase(updated);

    // DM new manager with full case summary
    await postMessage(newManagerId, caseReassignedDmMessage({
      caseId, scenario: rec.scenario, level: rec.risk,
      state: rec.state, previousManagerId, hrNote: note,
    }));

    // Notify HR thread of reassignment
    if (rec.hrChannelId && rec.hrChannelTs) {
      await postMessage(
        rec.hrChannelId,
        [{ type: 'section', text: { type: 'mrkdwn', text: `🔄  Case \`${caseId}\` reassigned from <@${previousManagerId}> to <@${newManagerId}> by <@${userId}>.${note ? `\n_${note}_` : ''}` } }],
        'Case reassigned',
        { thread_ts: rec.hrChannelTs }
      );
    }

    return ack('');
  }

  // pac_modal_export_cases → generate download link or email the file
  if (callbackId === C.MODAL_POLICY_LIBRARY) {
    const name     = values?.[B.POLICY_NAME]?.[A.POLICY_NAME_INPUT]?.value?.trim() || '';
    const scenario = values?.[B.POLICY_SCENARIO]?.[A.POLICY_SCENARIO_SELECT]?.selected_option?.value || '';
    const files    = values?.[B.POLICY_FILE]?.[A.POLICY_FILE]?.files || [];

    if (!name || !scenario) {
      return ack({ response_action: 'errors', errors: {
        [B.POLICY_NAME]:     !name     ? 'Policy name is required.' : undefined,
        [B.POLICY_SCENARIO]: !scenario ? 'Select a scenario.'       : undefined,
      }});
    }

    const fileRef = files[0] ? { fileId: files[0].id, fileName: files[0].name } : {};
    await savePolicy({
      id:         `pol_${Date.now()}`,
      name,
      scenario,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
      ...fileRef,
    });
    return ack();
  }

  if (callbackId === C.MODAL_EXPORT_CASES) {
    const isHr   = payload.view.private_metadata === 'hr';
    const format  = values?.[B.EXPORT_FORMAT]?.[A.EXPORT_FORMAT]?.selected_option?.value || 'csv';
    const filter  = isHr ? (values?.[B.EXPORT_FILTER]?.[A.EXPORT_FILTER]?.selected_option?.value || 'all') : 'manager';
    const delivery = values?.[B.EXPORT_DELIVERY]?.[A.EXPORT_DELIVERY]?.selected_option?.value || 'link';
    const emailInput = values?.[B.EXPORT_EMAIL]?.[A.EXPORT_EMAIL]?.value?.trim() || '';

    // ── HR "Post to Slack HR channel" delivery ────────────────────────────
    if (delivery === 'slack_channel' && isHr) {
      const hrChannelId = process.env.PAC_HR_CHANNEL_ID;
      if (!hrChannelId) {
        await postMessage(userId, [{ type: 'section', text: { type: 'mrkdwn', text: 'PAC_HR_CHANNEL_ID is not configured. Cannot post to channel.' } }]);
        return ack('');
      }

      let cases = await listAllCases().catch(() => []);
      if (filter === 'hr')   cases = cases.filter(c => c.hrNotified);
      if (filter === 'open') cases = cases.filter(c => !['CLOSED', 'ARCHIVED'].includes(c.state));

      // Build CSV: one row per case, Q&A columns expand per answer index
      const maxQ = cases.reduce((m, c) => Math.max(m, (c.questions || []).length), 0);
      const qHeaders = Array.from({ length: maxQ }, (_, i) => `Q${i + 1},A${i + 1}`).join(',');
      const header = `Case ID,Date,Scenario,Risk Level,State,Reference,HR Notified,Attachments,${qHeaders}`;

      const csvRows = cases.map(c => {
        const date = new Date(c.createdAt || c.updatedAt).toLocaleDateString('en-US');
        const qCols = Array.from({ length: maxQ }, (_, i) => {
          const q = (c.questions || [])[i];
          const a = (c.answers || [])[i] || '';
          if (!q) return ',';
          const qText = `"${(q.q || '').replace(/"/g, '""')}"`;
          return `${qText},"${a}"`;
        }).join(',');
        const ref = `"${(c.refName || '').replace(/"/g, '""')}"`;
        const scenarios = (c.scenarios || [c.scenario]).join(' + ');
        return `"${c.id}","${date}","${scenarios}","${c.risk || ''}","${c.state || ''}",${ref},"${c.hrNotified ? 'Yes' : 'No'}","${(c.attachments || []).length} file(s)",${qCols}`;
      });
      const csvContent = [header, ...csvRows].join('\n');
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `pac-cases-${dateStr}.csv`;

      await uploadFileToChannel(hrChannelId, filename, csvContent, `📊 PAC case export — ${cases.length} case${cases.length !== 1 ? 's' : ''} — ${dateStr}`);
      await postMessage(userId, [{ type: 'section', text: { type: 'mrkdwn', text: `✅  *Export posted to HR channel*\n${cases.length} case${cases.length !== 1 ? 's' : ''} exported as \`${filename}\`. HR can download it directly from the channel.` } }]);
      return ack('');
    }

    const token  = process.env.PAC_ADMIN_TOKEN;
    const filterParam = filter === 'all' ? '' : `&filter=${filter}`;
    const base   = `${WEB_APP_URL}/api/export-cases?token=${token}&format=${format}${filterParam}`;

    const FORMAT_LABELS = {
      csv: 'CSV (Excel / Google Sheets)',
      word: 'Word doc (.doc)',
      tsv: 'TSV (Excel tab-separated)',
      json: 'JSON',
    };

    if (delivery === 'link') {
      await postMessage(userId, [{
        type: 'section',
        text: { type: 'mrkdwn', text: `*Your export is ready*\n<${base}|Download ${FORMAT_LABELS[format]}>\n\nFor SharePoint, you can also email this to your document library address.` },
      }]);
      return ack('');
    }

    // Email delivery
    let toEmail = emailInput;
    if (delivery === 'email_self') {
      const hrEmail = await getHrEmail().catch(() => null);
      toEmail = hrEmail || emailInput;
    }
    if (!toEmail) {
      return ack({ response_action: 'errors', errors: { [B.EXPORT_EMAIL]: 'Enter an email address to send the export to.' } });
    }

    try {
      const res = await fetch(`${WEB_APP_URL}/api/export-cases?token=${token}&format=${format}${filterParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: toEmail }),
      });
      if (!res.ok) throw new Error(`Export API ${res.status}`);
      await postMessage(userId, [{
        type: 'section',
        text: { type: 'mrkdwn', text: `*Export sent*\nA ${FORMAT_LABELS[format]} file was emailed to \`${toEmail}\`.` },
      }]);
    } catch (e) {
      await postMessage(userId, [{
        type: 'section',
        text: { type: 'mrkdwn', text: `Export failed: ${e.message}. Try the download link instead: <${base}|${FORMAT_LABELS[format]}>` },
      }]);
    }
    return ack('');
  }

  return ack('');
}

// ── Main handler ──────────────────────────────────────────────────────────

exports.handler = async function (event) {
  activeToken = null;
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  console.log('PAC_SKIP_SIG_VERIFY:', process.env.PAC_SKIP_SIG_VERIFY);
  console.log('method:', event.httpMethod);
  if (!verifySignature(event)) {
    console.error('Slack signature verification failed');
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const parsed = parseBody(event);
  console.log('parsed command:', parsed.command, 'type:', parsed.type);

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
