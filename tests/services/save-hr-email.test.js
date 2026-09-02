// Tests for netlify/functions/save-hr-email.js
//
// Regression: this endpoint used to require an "Authorization: Bearer
// <PAC_ADMIN_TOKEN>" header that the browser client never sends (that
// secret is server-only, by design — see src/services/cases.js) and has
// no way to obtain. That made every save from the app's own UI 401,
// permanently, regardless of env config. HR email is meant to be gated
// only by the app's own client-side PIN prompt, the same as its sibling
// read endpoint get-hr-email.js, which has never required auth.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import Module from 'module';

const require = createRequire(import.meta.url);

let store;

// The handler is loaded via CJS require() below (it's a CommonJS Netlify
// function, not an ES module), so vi.mock — which only intercepts Vite's
// ESM import graph — can't reach it. Stubbing Module._load is what
// actually intercepts require('@netlify/blobs') in that path.
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === '@netlify/blobs') return { getStore: () => store };
  return originalLoad.call(this, request, ...rest);
};

function loadHandler() {
  const key = require.resolve('../../netlify/functions/save-hr-email.js');
  delete require.cache[key];
  return require('../../netlify/functions/save-hr-email.js').handler;
}

function makeEvent(overrides = {}) {
  return {
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hrEmail: 'hr@example.com' }),
    ...overrides,
  };
}

beforeEach(() => {
  const data = new Map();
  store = {
    set: vi.fn(async (k, v) => { data.set(k, v); }),
    get: vi.fn(async (k) => data.get(k) ?? null),
  };
});

describe('save-hr-email.js', () => {
  it('saves successfully with no Authorization header — matches what the browser client actually sends', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
    expect(store.set).toHaveBeenCalledWith('hrEmail', 'hr@example.com');
  });

  it('rejects an email missing "@"', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({ body: JSON.stringify({ hrEmail: 'not-an-email' }) }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 405 for non-POST methods', async () => {
    const handler = loadHandler();
    const res = await handler({ ...makeEvent(), httpMethod: 'GET' });
    expect(res.statusCode).toBe(405);
  });

  it('returns 200 for OPTIONS preflight', async () => {
    const handler = loadHandler();
    const res = await handler({ ...makeEvent(), httpMethod: 'OPTIONS' });
    expect(res.statusCode).toBe(200);
  });
});
