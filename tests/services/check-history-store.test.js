// Tests for netlify/functions/check-history-store.js
//
// Session History moved from localStorage to this server-side store: each
// record carries an ownerEmail (verified via Google Sign-In) so a manager's
// own view can be filtered to just their checks, while HR's "All Checks"
// view (no ?email=) sees everyone's, unfiltered.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import Module from 'module';

const require = createRequire(import.meta.url);

let data;
const store = {
  get: vi.fn(async (k) => data.get(k) ?? null),
  set: vi.fn(async (k, v) => { data.set(k, v); }),
};

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === './lib/blob-store' || request.endsWith('lib/blob-store')) {
    return { hrConfigStore: () => store };
  }
  return originalLoad.call(this, request, ...rest);
};

function loadHandler() {
  const key = require.resolve('../../netlify/functions/check-history-store.js');
  delete require.cache[key];
  return require('../../netlify/functions/check-history-store.js').handler;
}

function makeEvent(overrides = {}) {
  return { httpMethod: 'GET', headers: {}, queryStringParameters: {}, ...overrides };
}

beforeEach(() => {
  data = new Map();
});

describe('check-history-store.js', () => {
  it('creates a record with ownerEmail and lists it back unfiltered', async () => {
    const handler = loadHandler();
    const created = JSON.parse((await handler(makeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({ ownerEmail: 'a@co.com', scenario: 'Performance Decline', level: 'good' }),
    }))).body);
    expect(created.id).toBeTruthy();
    const { history } = JSON.parse((await handler(makeEvent({ httpMethod: 'GET' }))).body);
    expect(history).toHaveLength(1);
    expect(history[0].ownerEmail).toBe('a@co.com');
  });

  it('lists filtered by ?email= — only matching owner', async () => {
    const handler = loadHandler();
    await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ ownerEmail: 'a@co.com', scenario: 'A' }) }));
    await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ ownerEmail: 'b@co.com', scenario: 'B' }) }));
    const { history } = JSON.parse((await handler(makeEvent({ httpMethod: 'GET', queryStringParameters: { email: 'a@co.com' } }))).body);
    expect(history).toHaveLength(1);
    expect(history[0].scenario).toBe('A');
  });

  it('deletes one record by id', async () => {
    const handler = loadHandler();
    const a = JSON.parse((await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ ownerEmail: 'a@co.com', scenario: 'A' }) }))).body);
    const b = JSON.parse((await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ ownerEmail: 'a@co.com', scenario: 'B' }) }))).body);
    await handler(makeEvent({ httpMethod: 'DELETE', queryStringParameters: { id: String(a.id) } }));
    const { history } = JSON.parse((await handler(makeEvent({ httpMethod: 'GET' }))).body);
    expect(history.map(r => r.id)).toEqual([b.id]);
  });

  it('clearing by ?email= only removes that owner\'s records', async () => {
    const handler = loadHandler();
    await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ ownerEmail: 'a@co.com', scenario: 'A' }) }));
    await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ ownerEmail: 'b@co.com', scenario: 'B' }) }));
    await handler(makeEvent({ httpMethod: 'DELETE', queryStringParameters: { email: 'a@co.com' } }));
    const { history } = JSON.parse((await handler(makeEvent({ httpMethod: 'GET' }))).body);
    expect(history).toHaveLength(1);
    expect(history[0].ownerEmail).toBe('b@co.com');
  });

  it('clearing with no params clears everything', async () => {
    const handler = loadHandler();
    await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ ownerEmail: 'a@co.com', scenario: 'A' }) }));
    await handler(makeEvent({ httpMethod: 'DELETE' }));
    const { history } = JSON.parse((await handler(makeEvent({ httpMethod: 'GET' }))).body);
    expect(history).toEqual([]);
  });

  it('rejects a create request missing scenario', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ ownerEmail: 'a@co.com' }) }));
    expect(res.statusCode).toBe(400);
  });

  it('rejects a create request missing ownerEmail', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ scenario: 'A' }) }));
    expect(res.statusCode).toBe(400);
  });

  it('caps stored records at 50, newest first', async () => {
    const handler = loadHandler();
    for (let i = 0; i < 55; i++) {
      await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ ownerEmail: 'a@co.com', scenario: 'S' + i }) }));
    }
    const { history } = JSON.parse((await handler(makeEvent({ httpMethod: 'GET' }))).body);
    expect(history).toHaveLength(50);
    expect(history[0].scenario).toBe('S54');
  });
});
