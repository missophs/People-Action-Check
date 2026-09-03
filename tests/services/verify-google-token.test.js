// Tests for netlify/functions/verify-google-token.js
// Verifies a Google ID token by calling Google's tokeninfo endpoint —
// checks aud matches this app's client ID and email_verified is true.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const CLIENT_ID = '457583731351-di8h6sl5hjpv5ek5daog5l6muqn2o9v5.apps.googleusercontent.com';

function loadHandler() {
  const key = require.resolve('../../netlify/functions/verify-google-token.js');
  delete require.cache[key];
  return require('../../netlify/functions/verify-google-token.js').handler;
}

function makeEvent(overrides = {}) {
  return { httpMethod: 'POST', headers: {}, body: JSON.stringify({ credential: 'fake.jwt.token' }), ...overrides };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('verify-google-token.js', () => {
  it('returns 200 with email/name for a valid token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ aud: CLIENT_ID, email_verified: 'true', email: 'manager@co.com', name: 'Manager' }),
    }));
    const handler = loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.email).toBe('manager@co.com');
    expect(body.name).toBe('Manager');
  });

  it('returns 401 when aud does not match this app', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ aud: 'someone-elses-client-id', email_verified: 'true', email: 'manager@co.com' }),
    }));
    const handler = loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when email_verified is false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ aud: CLIENT_ID, email_verified: 'false', email: 'manager@co.com' }),
    }));
    const handler = loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when Google responds non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    const handler = loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(401);
  });

  it('handles a rejected fetch gracefully (no unhandled crash)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const handler = loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(401);
  });

  it('returns 405 for non-POST method', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({ httpMethod: 'GET' }));
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 for missing credential', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({ body: JSON.stringify({}) }));
    expect(res.statusCode).toBe(401);
  });
});
