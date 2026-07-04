// Export cases as CSV, TSV, Word doc, JSON, or email to HR.
// GET  /api/export-cases?format=csv|tsv|word|json&filter=hr|open&token=PAC_ADMIN_TOKEN
// POST /api/export-cases?format=csv|tsv|word&filter=hr|open&token=PAC_ADMIN_TOKEN
//      body: { email: "hr@company.com", subject: "optional subject" }
//      → generates report and emails it via Brevo; also works for SharePoint library emails

const dataStore = require('./lib/data-store');

const RISK_LABELS  = { good: 'Low Risk', warn: 'Elevated Risk', risk: 'High Risk' };
const RISK_COLORS  = { good: '#34d399', warn: '#f59e0b', risk: '#f43f5e' };

const STATE_LABELS = {
  NOT_STARTED: 'Not Started', IN_PROGRESS_WEB: 'In Progress (Web)',
  IN_PROGRESS_SLACK: 'In Progress (Slack)', SUBMITTED: 'Submitted to HR',
  ACKNOWLEDGED: 'Acknowledged', UNDER_REVIEW: 'Under Review',
  ESCALATED: 'Escalated', CLOSED: 'Closed', ARCHIVED: 'Archived',
};

function escCsv(val) {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function casesToRows(cases) {
  return cases.map(c => ({
    'Case ID':       c.id,
    'Scenario':      c.scenario,
    'Risk Level':    RISK_LABELS[c.risk] || c.risk,
    'State':         STATE_LABELS[c.state] || c.state,
    'HR Notified':   c.hrNotified ? 'Yes' : 'No',
    'Source':        c.source === 'slack' ? 'Slack' : 'Web App',
    'Docs Attached': (c.attachments || []).length,
    'Follow-ups':    c.followupCount || 0,
    'Created':       formatDate(c.createdAt),
    'Last Updated':  formatDate(c.updatedAt),
    'Manager ID':    c.managerId,
  }));
}

function toCsv(rows) {
  if (!rows.length) return 'No cases found.\n';
  const headers = Object.keys(rows[0]);
  return [
    headers.map(escCsv).join(','),
    ...rows.map(r => headers.map(h => escCsv(r[h])).join(',')),
  ].join('\n');
}

function toTsv(rows) {
  if (!rows.length) return 'No cases found.\n';
  const headers = Object.keys(rows[0]);
  return [
    headers.join('\t'),
    ...rows.map(r => headers.map(h => String(r[h] ?? '')).join('\t')),
  ].join('\n');
}

// Generates an HTML file Word opens natively — no npm package required.
// Opened in Word it looks like a formatted report with a table and header.
function toWordDoc(cases, filterLabel) {
  const generated = formatDate(new Date().toISOString());
  const rows = casesToRows(cases);

  const tableRows = rows.map(r => `
    <tr>
      <td>${escHtml(r['Case ID'])}</td>
      <td>${escHtml(r['Scenario'])}</td>
      <td style="color:${RISK_COLORS[cases[rows.indexOf(r)]?.risk] || '#000'}"><b>${escHtml(r['Risk Level'])}</b></td>
      <td>${escHtml(r['State'])}</td>
      <td>${escHtml(r['HR Notified'])}</td>
      <td>${escHtml(r['Source'])}</td>
      <td style="text-align:center">${escHtml(String(r['Docs Attached']))}</td>
      <td style="text-align:center">${escHtml(String(r['Follow-ups']))}</td>
      <td>${escHtml(r['Created'])}</td>
      <td>${escHtml(r['Last Updated'])}</td>
    </tr>`).join('');

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office'
  xmlns:w='urn:schemas-microsoft-com:office:word'
  xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>People Action Check — Case Report</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; margin: 1in; color: #1a1a1a; }
  h1 { font-size: 18pt; color: #1e293b; margin-bottom: 4pt; }
  .meta { color: #64748b; font-size: 10pt; margin-bottom: 20pt; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  th { background: #1e293b; color: #fff; padding: 6pt 8pt; text-align: left; font-weight: bold; }
  td { padding: 5pt 8pt; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .footer { margin-top: 20pt; font-size: 9pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8pt; }
</style>
</head>
<body>
<h1>People Action Check &mdash; Case Report</h1>
<p class="meta">
  Generated: ${generated}<br>
  Filter: ${escHtml(filterLabel)}<br>
  Total cases: ${cases.length}
</p>
${rows.length === 0 ? '<p>No cases found.</p>' : `
<table>
  <thead>
    <tr>
      <th>Case ID</th><th>Scenario</th><th>Risk Level</th><th>State</th>
      <th>HR Notified</th><th>Source</th><th>Docs</th><th>Follow-ups</th>
      <th>Created</th><th>Last Updated</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>`}
<p class="footer">People Action Check &bull; General guidance only &mdash; not legal advice.</p>
</body>
</html>`;
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function sendViaBrevo({ toEmail, subject, content, filename, contentType }) {
  const apiKey = process.env.BREVO_API_KEY;
  const from   = process.env.BREVO_SENDER_EMAIL || 'noreply@hractioncheck.netlify.app';
  if (!apiKey) throw new Error('BREVO_API_KEY not configured');

  const body = {
    sender:  { email: from, name: 'People Action Check' },
    to:      [{ email: toEmail }],
    subject,
    htmlContent: `<p>Your People Action Check case export is attached.</p>
      <p style="color:#64748b;font-size:12px;">People Action Check &bull; General guidance only &mdash; not legal advice.</p>`,
    attachment: [{
      name:    filename,
      content: Buffer.from(content).toString('base64'),
    }],
  };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error: ${res.status} ${err}`);
  }
  return res.json();
}

exports.handler = async function (event) {
  const token  = event.queryStringParameters?.token;
  const format = (event.queryStringParameters?.format || 'csv').toLowerCase();
  const filter = event.queryStringParameters?.filter;

  if (token !== process.env.PAC_ADMIN_TOKEN) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let cases = await dataStore.listAllCases();

  const filterLabel = filter === 'open' ? 'Open cases only'
    : filter === 'hr' ? 'HR-notified cases only'
    : 'All cases';

  if (filter === 'open') cases = cases.filter(c => !['CLOSED','ARCHIVED'].includes(c.state));
  else if (filter === 'hr') cases = cases.filter(c => c.hrNotified);

  cases.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  const rows     = casesToRows(cases);
  const datestamp = new Date().toISOString().slice(0,10);

  // ── Email delivery (POST with { email, subject? } body) ──────────────────
  if (event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {}
    const toEmail = body.email;
    if (!toEmail) return { statusCode: 400, body: JSON.stringify({ error: 'email required in body' }) };

    let content, filename, contentType;
    if (format === 'word') {
      content     = toWordDoc(cases, filterLabel);
      filename    = `pac-cases-${datestamp}.doc`;
      contentType = 'application/msword';
    } else if (format === 'tsv') {
      content     = toTsv(rows);
      filename    = `pac-cases-${datestamp}.tsv`;
      contentType = 'text/tab-separated-values';
    } else if (format === 'json') {
      content     = JSON.stringify(cases, null, 2);
      filename    = `pac-cases-${datestamp}.json`;
      contentType = 'application/json';
    } else {
      content     = toCsv(rows);
      filename    = `pac-cases-${datestamp}.csv`;
      contentType = 'text/csv';
    }

    const subject = body.subject
      || `People Action Check — Case Export (${filterLabel}) — ${datestamp}`;

    try {
      await sendViaBrevo({ toEmail, subject, content, filename, contentType });
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, sentTo: toEmail, filename }),
      };
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── Direct download (GET) ─────────────────────────────────────────────────
  if (format === 'word') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/msword',
        'Content-Disposition': `attachment; filename="pac-cases-${datestamp}.doc"`,
      },
      body: toWordDoc(cases, filterLabel),
    };
  }

  if (format === 'tsv') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/tab-separated-values; charset=utf-8',
        'Content-Disposition': `attachment; filename="pac-cases-${datestamp}.tsv"`,
      },
      body: toTsv(rows),
    };
  }

  if (format === 'json') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="pac-cases-${datestamp}.json"`,
      },
      body: JSON.stringify(cases, null, 2),
    };
  }

  // Default: CSV
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pac-cases-${datestamp}.csv"`,
    },
    body: toCsv(rows),
  };
};
