// Supabase (PostgreSQL) backend.
// Good for: enterprise, proper querying, row-level security, audit compliance,
//           EU data residency, GDPR, scales to millions of rows.
//
// Setup:
//   1. Create a Supabase project at supabase.com
//   2. Run the SQL in docs/supabase-schema.sql in the Supabase SQL editor
//   3. Set env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Uses direct REST fetch — no SDK dependency required in Netlify Functions.

const SUPABASE_URL  = () => process.env.SUPABASE_URL;
const SERVICE_KEY   = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE         = 'pac_cases';

function headers() {
  return {
    'Content-Type': 'application/json',
    'apikey':        SERVICE_KEY(),
    'Authorization': `Bearer ${SERVICE_KEY()}`,
    'Prefer':        'return=representation',
  };
}

async function supabaseRequest(path, method = 'GET', body = null) {
  const url = `${SUPABASE_URL()}/rest/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path}: ${res.status} ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Map flat DB row → case record object
function fromRow(row) {
  if (!row) return null;
  return {
    id:            row.case_id,
    managerId:     row.manager_id,
    scenario:      row.scenario,
    scenarios:     row.scenarios || [row.scenario],
    refName:       row.ref_name || '',
    risk:          row.risk,
    state:         row.state,
    source:        row.source,
    answers:       row.answers || [],
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
    hrNotified:    row.hr_notified || false,
    hrChannelId:   row.hr_channel_id || null,
    hrChannelTs:   row.hr_channel_ts || null,
    dmTs:          row.dm_ts || null,
    dmChannelId:   row.dm_channel_id || null,
    followupCount: row.followup_count || 0,
    attachments:   row.attachments || [],
    auditLog:      row.audit_log || [],
  };
}

// Map case record object → flat DB row
function toRow(rec) {
  return {
    case_id:        rec.id,
    manager_id:     rec.managerId,
    scenario:       rec.scenario,
    scenarios:      rec.scenarios || [rec.scenario],
    ref_name:       rec.refName || '',
    risk:           rec.risk,
    state:          rec.state,
    source:         rec.source || 'slack',
    answers:        rec.answers || [],
    updated_at:     rec.updatedAt || new Date().toISOString(),
    hr_notified:    rec.hrNotified || false,
    hr_channel_id:  rec.hrChannelId || null,
    hr_channel_ts:  rec.hrChannelTs || null,
    dm_ts:          rec.dmTs || null,
    dm_channel_id:  rec.dmChannelId || null,
    followup_count: rec.followupCount || 0,
    attachments:    rec.attachments || [],
    audit_log:      rec.auditLog || [],
  };
}

async function getCase(managerId, caseId) {
  const rows = await supabaseRequest(
    `${TABLE}?case_id=eq.${encodeURIComponent(caseId)}&manager_id=eq.${encodeURIComponent(managerId)}&limit=1`
  );
  return fromRow(rows?.[0]);
}

async function saveCase(rec) {
  const row = toRow(rec);
  // Upsert on case_id
  await supabaseRequest(`${TABLE}?on_conflict=case_id`, 'POST', row);
}

async function findCaseById(caseId) {
  const rows = await supabaseRequest(
    `${TABLE}?case_id=eq.${encodeURIComponent(caseId)}&limit=1`
  );
  return fromRow(rows?.[0]);
}

async function listCasesForManager(managerId) {
  const rows = await supabaseRequest(
    `${TABLE}?manager_id=eq.${encodeURIComponent(managerId)}&order=created_at.desc`
  );
  return (rows || []).map(fromRow);
}

async function listAllCases() {
  const rows = await supabaseRequest(
    `${TABLE}?order=updated_at.desc`
  );
  return (rows || []).map(fromRow);
}

async function deleteCase(managerId, caseId) {
  await supabaseRequest(
    `${TABLE}?case_id=eq.${encodeURIComponent(caseId)}&manager_id=eq.${encodeURIComponent(managerId)}`,
    'DELETE'
  );
}

module.exports = { getCase, saveCase, findCaseById, listCasesForManager, listAllCases, deleteCase };
