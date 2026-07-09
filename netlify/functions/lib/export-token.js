// Short-lived signed export tokens — keeps PAC_ADMIN_TOKEN out of Slack-visible URLs.
// Uses EXPORT_TOKEN_SECRET env var; falls back to PAC_ADMIN_TOKEN if not set.
// Tokens are HMAC-SHA256 signed and expire after a configurable TTL (default 300s).

const crypto = require('crypto');

function secret() {
  const s = process.env.EXPORT_TOKEN_SECRET || process.env.PAC_ADMIN_TOKEN;
  if (!s) throw new Error('EXPORT_TOKEN_SECRET or PAC_ADMIN_TOKEN must be set');
  return s;
}

/**
 * Sign an export payload into a short-lived opaque token.
 * @param {object} payload  - arbitrary JSON-serialisable data
 * @param {number} ttlSecs  - seconds until expiry (default 300)
 * @returns {string} base64url-encoded token
 */
function sign(payload, ttlSecs = 300) {
  const exp = Math.floor(Date.now() / 1000) + ttlSecs;
  const data = JSON.stringify({ payload, exp });
  const mac  = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return Buffer.from(JSON.stringify({ data, mac })).toString('base64url');
}

/**
 * Verify and decode a signed export token.
 * @param {string} token
 * @returns {object} original payload
 * @throws {Error} if invalid, tampered, or expired
 */
function verify(token) {
  let envelope;
  try {
    envelope = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid export token');
  }

  const { data, mac } = envelope;
  if (!data || !mac) throw new Error('Invalid export token');

  const expected = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) {
    throw new Error('Export token signature invalid');
  }

  let parsed;
  try { parsed = JSON.parse(data); } catch { throw new Error('Invalid export token'); }

  if (Math.floor(Date.now() / 1000) > parsed.exp) {
    throw new Error('Export token expired');
  }

  return parsed.payload;
}

module.exports = { sign, verify };
