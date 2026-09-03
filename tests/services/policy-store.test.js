// Tests for netlify/functions/policy-store.js
//
// Company policies moved from browser-only storage (localStorage +
// IndexedDB) to this server-side store: the Slack app runs server-side and
// has no access to any browser's local storage, so browser-only storage
// meant Slack could never see uploaded policies. This covers the CRUD
// surface: list stays metadata-only (cheap), a single doc carries its full
// text/PDF bytes, category updates merge instead of replacing, and delete
// (with or without an id) removes the right thing.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import Module from 'module';

const require = createRequire(import.meta.url);

let data;
const store = {
  get: vi.fn(async (k) => data.get(k) ?? null),
  set: vi.fn(async (k, v) => { data.set(k, v); }),
  delete: vi.fn(async (k) => { data.delete(k); }),
};

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === './lib/blob-store' || request.endsWith('lib/blob-store')) {
    return { hrConfigStore: () => store };
  }
  return originalLoad.call(this, request, ...rest);
};

function loadHandler() {
  const key = require.resolve('../../netlify/functions/policy-store.js');
  delete require.cache[key];
  return require('../../netlify/functions/policy-store.js').handler;
}

function makeEvent(overrides = {}) {
  return { httpMethod: 'GET', headers: {}, queryStringParameters: {}, ...overrides };
}

beforeEach(() => {
  data = new Map();
});

describe('policy-store.js', () => {
  it('creates a policy and returns metadata without text/pdfBase64', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({ name: 'Handbook.pdf', text: 'Some policy text', category: 'handbook', pdfBase64: 'ZmFrZQ==' }),
    }));
    expect(res.statusCode).toBe(200);
    const meta = JSON.parse(res.body);
    expect(meta.hasPdf).toBe(true);
    expect(meta.id).toBeTruthy();
    expect(meta.text).toBeUndefined();
    expect(meta.pdfBase64).toBeUndefined();
  });

  it('list returns metadata only, not the full content', async () => {
    const handler = loadHandler();
    await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ name: 'A', text: 'x'.repeat(500), pdfBase64: 'abc' }) }));
    const res = await handler(makeEvent({ httpMethod: 'GET' }));
    const { policies } = JSON.parse(res.body);
    expect(policies).toHaveLength(1);
    expect(policies[0].text).toBeUndefined();
    expect(policies[0].preview.length).toBeLessThanOrEqual(150);
  });

  it('fetching by id returns the full document, including pdfBase64', async () => {
    const handler = loadHandler();
    const created = JSON.parse((await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ name: 'A', text: 'full text here', pdfBase64: 'abc' }) }))).body);
    const res = await handler(makeEvent({ httpMethod: 'GET', queryStringParameters: { id: created.id } }));
    const doc = JSON.parse(res.body);
    expect(doc.text).toBe('full text here');
    expect(doc.pdfBase64).toBe('abc');
  });

  it('updating category merges instead of requiring the full document', async () => {
    const handler = loadHandler();
    const created = JSON.parse((await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ name: 'A', text: 'text', category: 'other' }) }))).body);
    const res = await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ id: created.id, category: 'handbook' }) }));
    expect(JSON.parse(res.body).category).toBe('handbook');
    const full = JSON.parse((await handler(makeEvent({ httpMethod: 'GET', queryStringParameters: { id: created.id } }))).body);
    expect(full.text).toBe('text'); // unrelated fields untouched
  });

  it('deleting one document removes only that one', async () => {
    const handler = loadHandler();
    const a = JSON.parse((await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ name: 'A', text: 'a' }) }))).body);
    const b = JSON.parse((await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ name: 'B', text: 'b' }) }))).body);
    await handler(makeEvent({ httpMethod: 'DELETE', queryStringParameters: { id: a.id } }));
    const { policies } = JSON.parse((await handler(makeEvent({ httpMethod: 'GET' }))).body);
    expect(policies.map(p => p.id)).toEqual([b.id]);
  });

  it('deleting with no id clears the whole library', async () => {
    const handler = loadHandler();
    await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ name: 'A', text: 'a' }) }));
    await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ name: 'B', text: 'b' }) }));
    await handler(makeEvent({ httpMethod: 'DELETE' }));
    const { policies } = JSON.parse((await handler(makeEvent({ httpMethod: 'GET' }))).body);
    expect(policies).toEqual([]);
  });

  it('rejects a create request missing text', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent({ httpMethod: 'POST', body: JSON.stringify({ name: 'A' }) }));
    expect(res.statusCode).toBe(400);
  });
});
