// Tests for netlify/functions/hr-submissions.js
//
// The HR Dashboard's "sent to HR" log moved from localStorage to this
// server-side store: different HR staff on different devices each had
// their own empty inbox before, since nothing was shared. Covers create,
// list, partial status/notes updates, and delete (one or all).

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
  const key = require.resolve('../../netlify/functions/hr-submissions.js');
  delete require.cache[key];
  return require('../../netlify/functions/hr-submissions.js').handler;
}

function makeEvent(overrides = {}) {
  return { httpMethod: 'GET', headers: {}, queryStringParameters: {}, ...overrides };
}

beforeEach(() => {
  data = new Map();
});

describe('hr-submissions.js', () => {
  it('creates a submission and lists it back', async () => {
    const handler = loadHandler();
    const created = JSON.parse((await handler(makeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({ scenario: 'Performance Decline', level: 'good', status: 'pending' }),
    }))).body);
    expect(created.id).toBeTruthy();
    const { submissions } = JSON.parse((await handler(makeEvent({ httpMethod: 'GET' }))).body);
    expect(submissions).toHaveLength(1);
    expect(submissions[0].scenario).toBe('Performance Decline');
  });

  it('updating status/notes merges onto the existing record', async () => {
    const handler = loadHandler();
    const created = JSON.parse((await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ scenario: 'Attendance Issue', status: 'pending' }) }))).body);
    const updated = JSON.parse((await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ id: created.id, status: 'resolved', hrNotes: 'handled' }) }))).body);
    expect(updated.status).toBe('resolved');
    expect(updated.hrNotes).toBe('handled');
    expect(updated.scenario).toBe('Attendance Issue'); // untouched fields survive
  });

  it('deleting one submission removes only that one', async () => {
    const handler = loadHandler();
    const a = JSON.parse((await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ scenario: 'A' }) }))).body);
    const b = JSON.parse((await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ scenario: 'B' }) }))).body);
    await handler(makeEvent({ httpMethod: 'DELETE', queryStringParameters: { id: String(a.id) } }));
    const { submissions } = JSON.parse((await handler(makeEvent({ httpMethod: 'GET' }))).body);
    expect(submissions.map(s => s.id)).toEqual([b.id]);
  });

  it('deleting with no id clears everything', async () => {
    const handler = loadHandler();
    await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ scenario: 'A' }) }));
    await handler(makeEvent({ httpMethod: 'DELETE' }));
    const { submissions } = JSON.parse((await handler(makeEvent({ httpMethod: 'GET' }))).body);
    expect(submissions).toEqual([]);
  });

  it('caps stored submissions at 50, newest first', async () => {
    const handler = loadHandler();
    for (let i = 0; i < 55; i++) {
      await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ scenario: 'S' + i }) }));
    }
    const { submissions } = JSON.parse((await handler(makeEvent({ httpMethod: 'GET' }))).body);
    expect(submissions).toHaveLength(50);
    expect(submissions[0].scenario).toBe('S54');
  });

  it('rejects a create request missing scenario', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ level: 'good' }) }));
    expect(res.statusCode).toBe(400);
  });
});
