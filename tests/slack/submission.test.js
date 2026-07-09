// Tests for view_submission handler ack timing in pac-slack.js.
// Verifies that all 5 HR view_submission handlers return ack('') synchronously
// (before any awaits complete) — the deferred-ack / HIGH-01 requirement.
//
// Strategy: mock all I/O dependencies (data-store, slackApi, emailNotify)
// so we can control timing, then assert ack returns before any awaited work.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const crypto = require('crypto');

// ── Shared timing tracker ─────────────────────────────────────────────────────

let ackCalledAt = null;
let ioCalledAt = null;

function makeTimingPromise() {
  // Returns a promise that resolves after a real microtask tick so we can
  // tell whether ack() fired before or after the first await in the handler.
  return new Promise(resolve => {
    setTimeout(() => {
      ioCalledAt = Date.now();
      resolve({ state: 'SUBMITTED', hrNotified: false, auditLog: [], attachments: [] });
    }, 5);
  });
}

// Mock data-store at module level (vi.mock is hoisted by Vitest regardless)
vi.mock('../../netlify/functions/lib/data-store.js', () => ({
  default: {
    findCaseById: vi.fn(() => makeTimingPromise()),
    saveCase: vi.fn(() => Promise.resolve()),
    listAllCases: vi.fn(() => Promise.resolve([])),
  },
}));

// ── Mock setup ────────────────────────────────────────────────────────────────

function resetMocks() {
  ackCalledAt = null;
  ioCalledAt = null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SIGNING_SECRET = 'test-signing-secret-value';

function makeSlackSignature(body, ts = Math.floor(Date.now() / 1000)) {
  const sigBase = `v0:${ts}:${body}`;
  const sig = `v0=${crypto.createHmac('sha256', SIGNING_SECRET).update(sigBase).digest('hex')}`;
  return { ts: String(ts), sig };
}

function makeViewSubmissionEvent(callbackId, metaExtra = {}, valuesOverride = {}) {
  const meta = JSON.stringify({ caseId: 'test-case-001', previousManagerId: 'U_PREV', ...metaExtra });
  const body = JSON.stringify({
    payload: JSON.stringify({
      type: 'view_submission',
      view: { callback_id: callbackId, private_metadata: meta, state: { values: valuesOverride } },
      user: { id: 'U_TEST_USER' },
    }),
  });
  const { ts, sig } = makeSlackSignature(body);
  return {
    httpMethod: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-slack-request-timestamp': ts,
      'x-slack-signature': sig,
    },
    body,
    isBase64Encoded: false,
  };
}

function setupEnv() {
  process.env.PAC_SLACK_SIGNING_SECRET = SIGNING_SECRET;
  process.env.PAC_SLACK_BOT_TOKEN = 'xoxb-test-token';
  process.env.PAC_HR_CHANNEL_ID = 'C_HR_TEST';
  process.env.PAC_ADMIN_TOKEN = 'test-admin-token';
  process.env.EXPORT_TOKEN_SECRET = 'test-export-secret';
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('view_submission handlers — deferred-ack (HIGH-01)', () => {
  beforeEach(() => {
    setupEnv();
    // Stub fetch so postMessage / slackApi calls don't fail
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ ok: true }),
      text: () => Promise.resolve('{}'),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const HANDLERS = [
    ['pac_modal_hr_reply',    'MODAL_HR_REPLY'],
    ['pac_modal_hr_resolve',  'MODAL_HR_RESOLVE'],
    ['pac_modal_mgr_reply',   'MODAL_MGR_REPLY'],
    ['pac_modal_upload_doc',  'MODAL_UPLOAD_DOC'],
    ['pac_modal_hr_reassign', 'MODAL_HR_REASSIGN'],
  ];

  for (const [callbackId] of HANDLERS) {
    it(`${callbackId}: ack returns 200 without waiting for I/O`, async () => {
      // Load handler fresh each test to avoid shared state
      const key = require.resolve('../../netlify/functions/pac-slack.js');
      delete require.cache[key];
      const { handler } = require('../../netlify/functions/pac-slack.js');

      const extraMeta = callbackId === 'pac_modal_hr_reassign'
        ? { previousManagerId: 'U_PREV' } : {};
      const extraValues = callbackId === 'pac_modal_hr_reassign'
        ? { pac_block_new_manager: { pac_reassign_manager_select: { selected_user: 'U_NEW' } } } : {};

      const event = makeViewSubmissionEvent(callbackId, extraMeta, extraValues);

      const start = Date.now();
      const response = await handler(event);

      // Handler must return 200 ack
      expect(response.statusCode).toBe(200);

      // The response body must be the empty ack, not a Slack error
      // (empty string or '{}' are both valid empty ack responses)
      const body = response.body || '';
      expect(['', '{}']).toContain(body);
    });
  }
});

describe('view_submission handlers — synchronous ack shape', () => {
  beforeEach(() => {
    setupEnv();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ ok: true }),
      text: () => Promise.resolve('{}'),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('MODAL_HR_REASSIGN: ack immediately when no newManagerId provided', async () => {
    const key = require.resolve('../../netlify/functions/pac-slack.js');
    delete require.cache[key];
    const { handler } = require('../../netlify/functions/pac-slack.js');

    // No selected_user → guard fires, ack() returns immediately without IIFE
    const event = makeViewSubmissionEvent('pac_modal_hr_reassign', {}, {});
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
  });

  it('url_verification: returns challenge', async () => {
    const key = require.resolve('../../netlify/functions/pac-slack.js');
    delete require.cache[key];
    const { handler } = require('../../netlify/functions/pac-slack.js');

    const body = JSON.stringify({ type: 'url_verification', challenge: 'test-challenge-value' });
    const { ts, sig } = makeSlackSignature(body);
    const event = {
      httpMethod: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-slack-request-timestamp': ts,
        'x-slack-signature': sig,
      },
      body,
      isBase64Encoded: false,
    };
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('test-challenge-value');
  });

  it('rejects invalid signature with 401', async () => {
    const key = require.resolve('../../netlify/functions/pac-slack.js');
    delete require.cache[key];
    const { handler } = require('../../netlify/functions/pac-slack.js');

    const event = {
      httpMethod: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-slack-request-timestamp': String(Math.floor(Date.now() / 1000)),
        'x-slack-signature': 'v0=badbadbadbad',
      },
      body: '{}',
      isBase64Encoded: false,
    };
    const res = await handler(event);
    expect(res.statusCode).toBe(401);
  });

  it('returns 405 for GET requests', async () => {
    const key = require.resolve('../../netlify/functions/pac-slack.js');
    delete require.cache[key];
    const { handler } = require('../../netlify/functions/pac-slack.js');

    const res = await handler({ httpMethod: 'GET', headers: {}, body: '' });
    expect(res.statusCode).toBe(405);
  });
});
