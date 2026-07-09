// Tests for netlify/functions/lib/export-token.js
// Validates HMAC-SHA256 signed token creation and verification.

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Set env before requiring the module so secret() resolves
beforeEach(() => {
  process.env.EXPORT_TOKEN_SECRET = 'test-secret-key-for-unit-tests';
  delete process.env.PAC_ADMIN_TOKEN;
});

// Re-require each test so env changes take effect
function load() {
  // Bust require cache so the module re-reads env each import
  const key = require.resolve('../../netlify/functions/lib/export-token.js');
  delete require.cache[key];
  return require('../../netlify/functions/lib/export-token.js');
}

describe('export-token — sign + verify round-trip', () => {
  it('sign returns a non-empty string', () => {
    const { sign } = load();
    expect(typeof sign({ format: 'csv' })).toBe('string');
    expect(sign({ format: 'csv' }).length).toBeGreaterThan(10);
  });

  it('verify returns original payload', () => {
    const { sign, verify } = load();
    const payload = { format: 'csv', filter: 'open' };
    const token = sign(payload, 300);
    expect(verify(token)).toEqual(payload);
  });

  it('verify throws on tampered token', () => {
    const { sign, verify } = load();
    const token = sign({ format: 'csv' }, 300);
    // Flip last char
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(() => verify(tampered)).toThrow();
  });

  it('verify throws on expired token', async () => {
    const { sign, verify } = load();
    // TTL of 0 means already expired
    const token = sign({ format: 'csv' }, -1);
    expect(() => verify(token)).toThrow(/expired/i);
  });

  it('verify throws on garbage input', () => {
    const { verify } = load();
    expect(() => verify('notavalidtoken')).toThrow();
    expect(() => verify('')).toThrow();
  });

  it('tokens with different TTLs produce different values', () => {
    const { sign } = load();
    const payload = { format: 'csv' };
    const t1 = sign(payload, 300);
    const t2 = sign(payload, 600);
    // Different exp → different token
    expect(t1).not.toBe(t2);
  });

  it('tokens signed with different secrets do not verify cross-secret', () => {
    process.env.EXPORT_TOKEN_SECRET = 'secret-A';
    const { sign } = load();
    const token = sign({ format: 'csv' }, 300);

    process.env.EXPORT_TOKEN_SECRET = 'secret-B';
    const { verify } = load();
    expect(() => verify(token)).toThrow();
  });

  it('throws when no secret configured', () => {
    delete process.env.EXPORT_TOKEN_SECRET;
    delete process.env.PAC_ADMIN_TOKEN;
    const { sign } = load();
    expect(() => sign({ format: 'csv' })).toThrow(/EXPORT_TOKEN_SECRET/);
  });

  it('falls back to PAC_ADMIN_TOKEN when EXPORT_TOKEN_SECRET absent', () => {
    delete process.env.EXPORT_TOKEN_SECRET;
    process.env.PAC_ADMIN_TOKEN = 'fallback-admin-token';
    const { sign, verify } = load();
    const token = sign({ format: 'tsv' }, 300);
    expect(verify(token)).toEqual({ format: 'tsv' });
  });
});
