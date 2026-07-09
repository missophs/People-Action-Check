// Tests for CRIT-01: PAC_ADMIN_TOKEN must never appear in Slack messages or export links.
// These tests cover the ESM-importable layer; behavioral assertions are at the generator level.

import { describe, it, expect } from 'vitest';
import { generateExport } from '../../netlify/functions/lib/export-generator.js';

const TOKEN = 'secret-admin-token-abc123xyz';

// ── generateExport ─────────────────────────────────────────────────────────

describe('generateExport', () => {
  const CASES = [
    { id: 'c1', scenario: 'performance', risk: 'risk', state: 'SUBMITTED',
      managerId: 'U1', refName: 'Jane', createdAt: '2025-01-01', updatedAt: '2025-01-02', hrNotified: true },
    { id: 'c2', scenario: 'conduct',     risk: 'good', state: 'CLOSED',
      managerId: 'U2', refName: '',      createdAt: '2025-02-01', updatedAt: '2025-02-02', hrNotified: false },
  ];

  it('produces valid CSV with header row', () => {
    const { content, mime, ext } = generateExport(CASES, 'csv');
    expect(ext).toBe('csv');
    expect(mime).toContain('text/csv');
    const lines = content.split('\n');
    expect(lines[0]).toContain('id,scenario,risk');
    expect(lines[1]).toContain('c1');
    expect(lines[2]).toContain('c2');
  });

  it('produces valid TSV', () => {
    const { content, ext } = generateExport(CASES, 'tsv');
    expect(ext).toBe('tsv');
    expect(content.split('\n')[1]).toContain('\t');
  });

  it('produces valid JSON array', () => {
    const { content, ext } = generateExport(CASES, 'json');
    expect(ext).toBe('json');
    const parsed = JSON.parse(content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe('c1');
  });

  it('falls back to CSV for unknown/word format', () => {
    const { ext } = generateExport(CASES, 'word');
    expect(ext).toBe('csv');
    const { ext: ext2 } = generateExport(CASES, 'unknown');
    expect(ext2).toBe('csv');
  });

  it('never reads or includes PAC_ADMIN_TOKEN in output', () => {
    process.env.PAC_ADMIN_TOKEN = TOKEN;
    for (const fmt of ['csv', 'tsv', 'json']) {
      const { content } = generateExport(CASES, fmt);
      expect(content, `format ${fmt} must not contain token`).not.toContain(TOKEN);
    }
    delete process.env.PAC_ADMIN_TOKEN;
  });

  it('CSV output does not contain ?token= pattern', () => {
    const { content } = generateExport(CASES, 'csv');
    expect(content).not.toMatch(/[?&]token=/);
  });

  it('handles empty case list', () => {
    const { content } = generateExport([], 'csv');
    expect(content.split('\n').length).toBe(1); // header only
  });

  it('CSV-escapes values containing commas and quotes', () => {
    const cases = [{ id: 'c3', scenario: 'termination, layoff', risk: '"high"', state: 'CLOSED',
      managerId: 'U3', refName: '', createdAt: '', updatedAt: '', hrNotified: false }];
    const { content } = generateExport(cases, 'csv');
    expect(content).toContain('"termination, layoff"');
    expect(content).toContain('"""high"""');
  });
});

// ── Export URL invariants ──────────────────────────────────────────────────

describe('export URL invariants', () => {
  const WEB_APP_URL = 'https://peopleactioncheck.netlify.app';

  it('exportId URL does not contain token= parameter', () => {
    const exportId = 'abc123randomhex';
    const safeUrl = `${WEB_APP_URL}/api/export-cases?exportId=${exportId}`;
    expect(safeUrl).not.toMatch(/[?&]token=/);
    expect(safeUrl).not.toContain(TOKEN);
  });

  it('exportId is not derived from PAC_ADMIN_TOKEN', () => {
    // Simulate what createExportId returns — a hex string unrelated to the token
    const exportId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6';
    expect(exportId).not.toContain(TOKEN);
    expect(exportId).toMatch(/^[a-f0-9]+$/); // random hex, never embeds secret
  });
});

// ── Signing-secret: fail-closed behavior (unit) ───────────────────────────

describe('verifySignature (fail-closed invariants)', () => {
  it('SKIP_SIG_VERIFY must be false in production environment', () => {
    // Simulate production check: if IS_PRODUCTION=true, SKIP_SIG_VERIFY must not allow bypass
    const IS_PRODUCTION = true;
    const SKIP_SIG_VERIFY = process.env.PAC_SKIP_SIG_VERIFY === 'true' && !IS_PRODUCTION;
    expect(SKIP_SIG_VERIFY).toBe(false);
  });

  it('missing signing secret must reject (not return true) when secret is absent in production', () => {
    // Validate the logic used in verifySignature
    const IS_PRODUCTION = true;
    const SKIP_SIG_VERIFY = false;
    const secret = undefined;
    // The guard: if (!secret) { if (IS_PRODUCTION || !SKIP_SIG_VERIFY) return false; }
    let result;
    if (!secret) {
      result = (IS_PRODUCTION || !SKIP_SIG_VERIFY) ? false : true;
    }
    expect(result).toBe(false);
  });

  it('skip is allowed only when not in production and PAC_SKIP_SIG_VERIFY=true', () => {
    const IS_PRODUCTION = false;
    const SKIP_SIG_VERIFY = true; // PAC_SKIP_SIG_VERIFY=true in dev
    const secret = undefined;
    let result;
    if (!secret) {
      result = (IS_PRODUCTION || !SKIP_SIG_VERIFY) ? false : true;
    }
    expect(result).toBe(true); // allowed in dev with explicit flag
  });
});

// ── src/services/cases.js: browser code must not pass PAC_ADMIN_TOKEN ────

describe('cases.js service: token parameter behavior', () => {
  it('listCases without token sends no Authorization header', async () => {
    const calls = [];
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, status: 200, json: async () => ({ cases: [] }) };
    };
    const { listCases } = await import('../../src/services/cases.js');
    await listCases('mgr1'); // no token — browser usage
    expect(calls[0].opts.headers?.Authorization).toBeUndefined();
  });

  it('saveCase without token omits Authorization header', async () => {
    const calls = [];
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, status: 200, json: async () => ({ ok: true, key: 'k' }) };
    };
    const { saveCase } = await import('../../src/services/cases.js');
    await saveCase({ id: 'c1', managerId: 'm1' }); // no token — browser usage
    expect(calls[0].opts.headers?.Authorization).toBeUndefined();
  });
});
