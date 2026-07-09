// Airtable backend.
// Good for: HR teams who want to view and manage cases in a spreadsheet UI,
//           no-code filtering/sorting, easy export, visual dashboards.
// Limitations: slower API (rate-limited to 5 req/s), row limit 50k on free,
//              no relational joins, JSON fields stored as text.
//
// Setup:
//   1. Create an Airtable account at airtable.com
//   2. Create a new Base called "People Action Check"
//   3. Create a table called "Cases" with the fields in docs/airtable-schema.md
//   4. Create a Personal Access Token at airtable.com/create/tokens
//      Scopes required: data.records:read, data.records:write
//   5. Set env vars: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME (default: Cases)
//
// HR benefit: open the base in Airtable and see every case, filter by risk level,
// manager, state, date — no code required. Export to CSV for reporting.

const API_BASE = 'https://api.airtable.com/v0';
const BASE_ID  = () => process.env.AIRTABLE_BASE_ID;
const TABLE    = () => encodeURIComponent(process.env.AIRTABLE_TABLE_NAME || 'Cases');
const API_KEY  = () => process.env.AIRTABLE_API_KEY;

function headers() {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${API_KEY()}`,
  };
}

async function airtableRequest(path, method = 'GET', body = null) {
  const url = `${API_BASE}/${BASE_ID()}/${TABLE()}${path}`;
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable ${method} ${path}: ${res.status} ${err}`);
  }
  return res.json();
}

// Map Airtable fields → case record
function fromFields(fields, recordId) {
  return {
    _airtableId:   recordId,
    id:            fields['Case ID'],
    managerId:     fields['Manager Slack ID'],
    scenario:      fields['Scenario'],
    scenarios:     safeJsonParse(fields['All Scenarios'], [fields['Scenario']]),
    refName:       fields['Reference'] || '',
    risk:          fields['Risk Level'],
    state:         fields['State'],
    source:        fields['Source'] || 'slack',
    answers:       safeJsonParse(fields['Answers'], []),
    createdAt:     fields['Created At'],
    updatedAt:     fields['Updated At'],
    hrNotified:    fields['HR Notified'] || false,
    hrChannelId:   fields['HR Channel ID'] || null,
    hrChannelTs:   fields['HR Channel Timestamp'] || null,
    dmTs:          fields['DM Timestamp'] || null,
    dmChannelId:   fields['DM Channel ID'] || null,
    followupCount: fields['Follow-up Count'] || 0,
    attachments:   safeJsonParse(fields['Attachments JSON'], []),
    auditLog:      safeJsonParse(fields['Audit Log'], []),
  };
}

// Map case record → Airtable fields
function toFields(rec) {
  return {
    'Case ID':              rec.id,
    'Manager Slack ID':     rec.managerId,
    'Scenario':             rec.scenario,
    'All Scenarios':        JSON.stringify(rec.scenarios || [rec.scenario]),
    'Reference':            rec.refName || '',
    'Risk Level':           rec.risk,
    'State':                rec.state,
    'Source':               rec.source || 'slack',
    'Answers':              JSON.stringify(rec.answers || []),
    'Updated At':           rec.updatedAt || new Date().toISOString(),
    'HR Notified':          rec.hrNotified || false,
    'HR Channel ID':        rec.hrChannelId || '',
    'HR Channel Timestamp': rec.hrChannelTs || '',
    'DM Timestamp':         rec.dmTs || '',
    'DM Channel ID':        rec.dmChannelId || '',
    'Follow-up Count':      rec.followupCount || 0,
    'Attachments JSON':     JSON.stringify(rec.attachments || []),
    'Audit Log':            JSON.stringify(rec.auditLog || []),
  };
}

function safeJsonParse(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

async function findRecordByCaseId(caseId) {
  const formula = encodeURIComponent(`{Case ID}="${caseId}"`);
  const data = await airtableRequest(`?filterByFormula=${formula}&maxRecords=1`);
  return data.records?.[0] || null;
}

async function getCase(managerId, caseId) {
  const rec = await findRecordByCaseId(caseId);
  if (!rec) return null;
  const parsed = fromFields(rec.fields, rec.id);
  return parsed.managerId === managerId ? parsed : null;
}

async function saveCase(caseRec) {
  const existing = await findRecordByCaseId(caseRec.id);
  const fields = toFields(caseRec);

  if (existing) {
    // Update existing record
    await airtableRequest(`/${existing.id}`, 'PATCH', { fields });
  } else {
    // Create new record — include Created At on first write
    await airtableRequest('', 'POST', {
      records: [{ fields: { ...fields, 'Created At': caseRec.createdAt || new Date().toISOString() } }],
    });
  }
}

async function findCaseById(caseId) {
  const rec = await findRecordByCaseId(caseId);
  return rec ? fromFields(rec.fields, rec.id) : null;
}

async function listCasesForManager(managerId) {
  const formula = encodeURIComponent(`{Manager Slack ID}="${managerId}"`);
  const data = await airtableRequest(`?filterByFormula=${formula}&sort%5B0%5D%5Bfield%5D=Created+At&sort%5B0%5D%5Bdirection%5D=desc`);
  return (data.records || []).map(r => fromFields(r.fields, r.id));
}

async function listAllCases() {
  // Airtable paginates at 100 records — fetch all pages
  const records = [];
  let offset;
  do {
    const path = offset ? `?offset=${offset}` : '';
    const data = await airtableRequest(path);
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return records.map(r => fromFields(r.fields, r.id));
}

async function deleteCase(managerId, caseId) {
  const rec = await findRecordByCaseId(caseId);
  if (rec) await airtableRequest(`/${rec.id}`, 'DELETE');
}

module.exports = { getCase, saveCase, findCaseById, listCasesForManager, listAllCases, deleteCase };
