// Tests for netlify/functions/notify.js
// Validates authentication, domain allowlist, and SSRF protection.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function loadHandler() {
  const key = require.resolve('../../netlify/functions/notify.js');
  delete require.cache[key];
  return require('../../netlify/functions/notify.js').handler;
}

function makeEvent(overrides = {}) {
  return {
    httpMethod: 'POST',
    headers: {
      authorization: `Bearer test-admin-token`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ webhookUrl: 'https://hooks.slack.com/test', payload: { text: 'hi' } }),
    ...overrides,
  };
}

beforeEach(() => {
  process.env.PAC_ADMIN_TOKEN = 'test-admin-token';
  process.env.NOTIFY_ALLOWED_DOMAINS = 'hooks.slack.com';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
});

describe('notify.js — authentication', () => {
  it('returns 405 for non-POST method', async () => {
    const handler = loadHandler();
    const res = await handler({ ...makeEvent(), httpMethod: 'GET' });
    expect(res.statusCode).toBe(405);
  });

  it('returns 200 for OPTIONS preflight', async () => {
    const handler = loadHandler();
    const res = await handler({ ...makeEvent(), httpMethod: 'OPTIONS' });
    expect(res.statusCode).toBe(200);
  });

  it('returns 401 without Authorization header', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({ headers: {} }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with wrong token', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({ headers: { authorization: 'Bearer wrong-token' } }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 503 when PAC_ADMIN_TOKEN not set', async () => {
    delete process.env.PAC_ADMIN_TOKEN;
    const handler = loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(503);
  });

  it('returns 200 with correct Bearer token', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(200);
  });
});

describe('notify.js — domain allowlist (SSRF protection)', () => {
  it('returns 503 when NOTIFY_ALLOWED_DOMAINS not configured', async () => {
    delete process.env.NOTIFY_ALLOWED_DOMAINS;
    const handler = loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(503);
  });

  it('returns 403 for hostname not in allowlist', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({
      body: JSON.stringify({ webhookUrl: 'https://evil.com/steal', payload: {} }),
    }));
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for http (non-https) webhookUrl', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({
      body: JSON.stringify({ webhookUrl: 'http://hooks.slack.com/test', payload: {} }),
    }));
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for hostname not in allowlist even with similar prefix', async () => {
    // hooks.slack.com.evil.com should NOT be allowed just because hooks.slack.com is
    const handler = loadHandler();
    const res = await handler(makeEvent({
      body: JSON.stringify({ webhookUrl: 'https://hooks.slack.com.evil.com/steal', payload: {} }),
    }));
    expect(res.statusCode).toBe(403);
  });

  it('allows multiple domains in NOTIFY_ALLOWED_DOMAINS', async () => {
    process.env.NOTIFY_ALLOWED_DOMAINS = 'hooks.slack.com,discord.com';
    const handler = loadHandler();
    const res = await handler(makeEvent({
      body: JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/test', payload: {} }),
    }));
    expect(res.statusCode).toBe(200);
  });
});

describe('notify.js — input validation', () => {
  it('returns 400 for invalid JSON body', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({ body: 'not json' }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when webhookUrl missing', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({
      body: JSON.stringify({ payload: { text: 'hi' } }),
    }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid webhookUrl format', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({
      body: JSON.stringify({ webhookUrl: 'not-a-url', payload: {} }),
    }));
    expect(res.statusCode).toBe(400);
  });

  it('proxies payload to allowed webhook and returns ok', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent());
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
