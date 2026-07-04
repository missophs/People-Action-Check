// Netlify Blobs backend — original storage implementation.
// Good for: zero-config deploy, prototyping, small teams.
// Limitations: no querying (full scan to find by caseId), tied to Netlify.

const { getStore } = require('@netlify/blobs');

function store() {
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token  = process.env.NETLIFY_BLOBS_TOKEN;
  return (siteID && token)
    ? getStore({ name: 'pac-cases', siteID, token })
    : getStore('pac-cases');
}

function blobKey(managerId, caseId) {
  return `case/${managerId}/${caseId}`;
}

async function getCase(managerId, caseId) {
  const raw = await store().get(blobKey(managerId, caseId));
  return raw ? JSON.parse(raw) : null;
}

async function saveCase(rec) {
  await store().set(blobKey(rec.managerId, rec.id), JSON.stringify(rec));
}

async function findCaseById(caseId) {
  const s = store();
  const { blobs } = await s.list({ prefix: 'case/' });
  for (const blob of blobs) {
    if (blob.key.endsWith(`/${caseId}`)) {
      const raw = await s.get(blob.key);
      return raw ? JSON.parse(raw) : null;
    }
  }
  return null;
}

async function listCasesForManager(managerId) {
  const s = store();
  const { blobs } = await s.list({ prefix: `case/${managerId}/` });
  const rows = await Promise.all(blobs.map(b => s.get(b.key)));
  return rows.filter(Boolean).map(r => JSON.parse(r));
}

async function listAllCases() {
  const s = store();
  const { blobs } = await s.list({ prefix: 'case/' });
  const rows = await Promise.all(blobs.map(b => s.get(b.key)));
  return rows.filter(Boolean).map(r => JSON.parse(r));
}

async function deleteCase(managerId, caseId) {
  await store().delete(blobKey(managerId, caseId));
}

module.exports = { getCase, saveCase, findCaseById, listCasesForManager, listAllCases, deleteCase };
