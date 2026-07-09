// PAC export endpoint — Netlify Function.
// Authorization: PAC_ADMIN_TOKEN via "Authorization: Bearer <token>" header ONLY.
// PAC_ADMIN_TOKEN must NEVER appear in URLs, query params, or response bodies.
//
// Short-lived exportId flow (for Slack links):
//   GET /api/export-cases?exportId=<id>   — no auth needed; exportId is single-use, 1-hour TTL
//
// Direct download flow (for browser/admin tools):
//   GET /api/export-cases?format=csv&filter=all  — requires Authorization: Bearer <PAC_ADMIN_TOKEN>

const { getPacAdminToken } = require('./lib/secrets.cjs');
const { getStore } = require('@netlify/blobs');

const HEADERS_BASE = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const EXPORT_ID_TTL_MS = 60 * 60 * 1000; // 1 hour

function caseStoreHandle() {
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const tok    = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && tok) return getStore({ name: 'pac-cases', siteID, token: tok });
  return getStore('pac-cases');
}

function exportIdStoreHandle() {
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const tok    = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && tok) return getStore({ name: 'pac-export-ids', siteID, token: tok });
  return getStore('pac-export-ids');
}

async function listAllCases() {
  const store = caseStoreHandle();
  const { blobs } = await store.list({ prefix: 'case/' });
  const rows = await Promise.all(blobs.map(b => store.get(b.key)));
  return rows.filter(Boolean).map(r => JSON.parse(r));
}

async function listCasesForManager(managerId) {
  const store = caseStoreHandle();
  const { blobs } = await store.list({ prefix: `case/${managerId}/` });
  const rows = await Promise.all(blobs.map(b => store.get(b.key)));
  return rows.filter(Boolean).map(r => JSON.parse(r));
}

function fail(status, msg) {
  return { statusCode: status, headers: HEADERS_BASE, body: JSON.stringify({ error: msg }) };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS_BASE, body: '' };
  if (event.httpMethod !== 'GET') return fail(405, 'Method not allowed');

  const { generateExport } = await import('./lib/export-generator.js');
  const params = event.queryStringParameters || {};

  // ── Short-lived exportId path (used by Slack links) ──────────────────────
  if (params.exportId) {
    const exportIdStore = exportIdStoreHandle();
    const raw = await exportIdStore.get(params.exportId).catch(() => null);
    if (!raw) return fail(404, 'Export link not found or expired');

    let meta;
    try { meta = JSON.parse(raw); } catch { return fail(400, 'Invalid export metadata'); }

    if (Date.now() - new Date(meta.createdAt).getTime() > EXPORT_ID_TTL_MS) {
      await exportIdStore.delete(params.exportId).catch(() => {});
      return fail(410, 'Export link has expired');
    }

    await exportIdStore.delete(params.exportId).catch(() => {}); // single-use
    const cases = meta.filter === 'manager' && meta.managerId
      ? await listCasesForManager(meta.managerId)
      : await listAllCases();

    const { content, mime, ext } = generateExport(cases, meta.format || 'csv');
    const filename = `pac-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
    return {
      statusCode: 200,
      headers: { ...HEADERS_BASE, 'Content-Type': mime, 'Content-Disposition': `attachment; filename="${filename}"` },
      body: content,
    };
  }

  // ── Direct download path (requires Bearer token) ──────────────────────────
  let adminToken;
  try { adminToken = getPacAdminToken(); } catch {
    return fail(503, 'Export not configured');
  }

  const auth = (event.headers['authorization'] || event.headers['Authorization'] || '').replace('Bearer ', '');
  if (!auth || auth !== adminToken) return fail(401, 'Unauthorized');

  const { format = 'csv', filter = 'all', managerId } = params;
  const cases = filter === 'manager' && managerId
    ? await listCasesForManager(managerId)
    : await listAllCases();

  const { content, mime, ext } = generateExport(cases, format);
  const filename = `pac-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
  return {
    statusCode: 200,
    headers: { ...HEADERS_BASE, 'Content-Type': mime, 'Content-Disposition': `attachment; filename="${filename}"` },
    body: content,
  };
};

// ── createExportId: generates a safe, random download link for Slack ──────────
// The ID is cryptographically random and does NOT derive from PAC_ADMIN_TOKEN.
exports.createExportId = async function (meta) {
  const { randomBytes } = require('crypto');
  const id = randomBytes(24).toString('hex');
  const store = exportIdStoreHandle();
  await store.set(id, JSON.stringify({ ...meta, createdAt: new Date().toISOString() }));
  return id;
};
