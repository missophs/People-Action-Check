// Email notification helper — Brevo-backed.
// Sends structured HTML emails to managers and HR, optionally with file attachments
// downloaded from Slack so recipients can access them directly from their inbox.
//
// Slack file download requires: files:read scope + PAC_SLACK_BOT_TOKEN

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';
const RISK_COLORS = { good: '#34d399', warn: '#f59e0b', risk: '#f43f5e' };
const RISK_LABELS = { good: 'Low Risk', warn: 'Elevated Risk', risk: 'High Risk' };
const STATE_LABELS = {
  NOT_STARTED: 'Not Started', IN_PROGRESS_WEB: 'In Progress (Web)',
  IN_PROGRESS_SLACK: 'In Progress (Slack)', SUBMITTED: 'Submitted to HR',
  ACKNOWLEDGED: 'Acknowledged', UNDER_REVIEW: 'Under Review',
  ESCALATED: 'Escalated', CLOSED: 'Closed', ARCHIVED: 'Archived',
};

function riskBadge(level) {
  const color = RISK_COLORS[level] || '#94a3b8';
  const label = RISK_LABELS[level] || level;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:4px;background:${color};color:#fff;font-weight:bold;font-size:12px">${label}</span>`;
}

function emailShell(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Calibri,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" align="center"
  style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <tr><td style="background:#1e293b;padding:20px 28px">
    <span style="color:#fff;font-size:20px;font-weight:bold">People Action Check</span>
    <span style="color:#94a3b8;font-size:14px;margin-left:12px">${title}</span>
  </td></tr>
  <tr><td style="padding:28px">${body}</td></tr>
  <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
    <span style="font-size:11px;color:#94a3b8">
      People Action Check &bull; General guidance only — not legal advice.
      Attachments are copies of files shared via Slack.
    </span>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// Download a file from Slack by file ID.
// Returns { name, content (base64 string), type } or null on failure.
async function downloadSlackFile(fileId) {
  const token = process.env.PAC_SLACK_BOT_TOKEN;
  if (!token) return null;

  try {
    // Get file metadata including download URL
    const infoRes = await fetch(`https://slack.com/api/files.info?file=${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const info = await infoRes.json();
    if (!info.ok || !info.file) return null;

    const { url_private_download, name, mimetype } = info.file;
    if (!url_private_download) return null;

    // Download the actual file bytes
    const dlRes = await fetch(url_private_download, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!dlRes.ok) return null;

    const buf = await dlRes.arrayBuffer();
    return {
      name:    name || fileId,
      content: Buffer.from(buf).toString('base64'),
      type:    mimetype || 'application/octet-stream',
    };
  } catch {
    return null;
  }
}

// Download multiple Slack files. Returns only the ones that succeeded.
async function downloadSlackFiles(fileRefs = []) {
  const results = await Promise.all(fileRefs.map(f => downloadSlackFile(f.id)));
  return results.filter(Boolean);
}

// Core send function — wraps Brevo.
async function sendEmail({ to, subject, html, attachments = [] }) {
  const apiKey  = process.env.BREVO_API_KEY;
  const from    = process.env.BREVO_SENDER_EMAIL || 'noreply@hractioncheck.netlify.app';
  if (!apiKey || !to) return;

  const body = {
    sender:      { email: from, name: 'People Action Check' },
    to:          Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }],
    subject,
    htmlContent: html,
  };
  if (attachments.length > 0) {
    body.attachment = attachments.map(a => ({ name: a.name, content: a.content }));
  }

  try {
    const res = await fetch(BREVO_API, {
      method:  'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Brevo email error:', res.status, await res.text());
    }
  } catch (e) {
    console.error('Brevo email exception:', e.message);
  }
}

// ── Notification events ───────────────────────────────────────────────────

// Called after manager finishes a check.
// managerEmail: looked up via Slack users.info
async function notifyManagerResult({ managerEmail, scenario, level, caseId, refName, selfCheck }) {
  if (!managerEmail) return;

  const label     = RISK_LABELS[level] || level;
  const isHigh    = level === 'risk';
  const subjectTag = selfCheck ? 'Self-Check' : `Case ${caseId}`;

  const html = emailShell('Check Complete', `
    <p style="margin:0 0 16px">Your People Action Check for <strong>${scenario}</strong> is complete.</p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      <tr><td style="color:#64748b;font-size:13px;padding:4px 12px 4px 0;width:120px">Risk level</td>
          <td>${riskBadge(level)}</td></tr>
      ${refName ? `<tr><td style="color:#64748b;font-size:13px;padding:4px 12px 4px 0">Reference</td>
          <td style="font-size:14px">${refName}</td></tr>` : ''}
      <tr><td style="color:#64748b;font-size:13px;padding:4px 12px 4px 0">Mode</td>
          <td style="font-size:14px">${selfCheck ? '🔒 Self-check — HR not notified' : 'Standard'}</td></tr>
      <tr><td style="color:#64748b;font-size:13px;padding:4px 12px 4px 0">Case ID</td>
          <td style="font-size:14px;font-family:monospace">${caseId}</td></tr>
    </table>
    ${isHigh && !selfCheck ? `<p style="background:#fef2f2;border-left:3px solid #f43f5e;padding:10px 14px;border-radius:4px;font-size:13px;margin:0">
      High Risk result — consider notifying HR if you have not already done so.
    </p>` : ''}
  `);

  await sendEmail({
    to:      managerEmail,
    subject: `People Action Check — ${label} — ${subjectTag}`,
    html,
  });
}

// Called when HR is notified of a case.
// fileRefs: attachments already on the case record (downloaded and included in email).
async function notifyHrOfCase({ hrEmail, scenario, level, caseId, managerSlackId, fileRefs = [], answers = [], questions = [], refName = '' }) {
  if (!hrEmail) return;

  const attachments = await downloadSlackFiles(fileRefs);

  // Build Q&A rows
  const ansLabel = { yes: '✅ Yes', no: '❌ No', unknown: '❓ Not sure' };
  const qaRows = questions.length > 0
    ? `<h3 style="margin:24px 0 8px;font-size:14px;color:#1e293b">Manager's Answers</h3>
       <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
         ${questions.map((q, i) => `
           <tr style="border-bottom:1px solid #e2e8f0">
             <td style="padding:8px 12px 8px 0;font-size:13px;color:#374151;vertical-align:top;width:70%">
               ${q.critical ? '<strong>⚠️ CRITICAL</strong><br>' : ''}${i + 1}. ${q.q}
             </td>
             <td style="padding:8px 0;font-size:13px;font-weight:600;vertical-align:top;white-space:nowrap">
               ${ansLabel[answers[i]] || '—'}
             </td>
           </tr>`).join('')}
       </table>`
    : '';

  // File links
  const fileSection = attachments.length > 0
    ? `<h3 style="margin:24px 0 8px;font-size:14px;color:#1e293b">Uploaded Documents</h3>
       <ul style="margin:0 0 16px;padding-left:20px;font-size:13px;color:#374151">
         ${attachments.map(a => `<li>${a.name} — see email attachment</li>`).join('')}
       </ul>`
    : '';

  const html = emailShell('New Case — HR Notified', `
    <p style="margin:0 0 16px">A manager has submitted a case for HR review. Full details are below.</p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:8px;width:100%">
      <tr><td style="color:#64748b;font-size:13px;padding:4px 12px 4px 0;width:130px">Scenario</td>
          <td style="font-size:14px"><strong>${scenario}</strong></td></tr>
      <tr><td style="color:#64748b;font-size:13px;padding:4px 12px 4px 0">Risk level</td>
          <td>${riskBadge(level)}</td></tr>
      <tr><td style="color:#64748b;font-size:13px;padding:4px 12px 4px 0">Case ID</td>
          <td style="font-size:14px;font-family:monospace">${caseId}</td></tr>
      <tr><td style="color:#64748b;font-size:13px;padding:4px 12px 4px 0">Manager</td>
          <td style="font-size:14px">${managerSlackId}</td></tr>
      ${refName ? `<tr><td style="color:#64748b;font-size:13px;padding:4px 12px 4px 0">Reference</td>
          <td style="font-size:14px">${refName}</td></tr>` : ''}
    </table>
    ${qaRows}
    ${fileSection}
    <p style="font-size:13px;color:#64748b;margin:16px 0 0">Respond to the manager directly in Slack via the People Action Check app.</p>
  `);

  await sendEmail({
    to:          hrEmail,
    subject:     `People Action Check — New Case — ${RISK_LABELS[level] || level} — ${caseId}`,
    html,
    attachments,
  });
}

// Called when manager or HR uploads documents.
// Emails both parties with the files attached.
async function notifyDocumentUploaded({ managerEmail, hrEmail, caseId, scenario, fileRefs = [], uploaderLabel = 'Manager' }) {
  const attachments = await downloadSlackFiles(fileRefs);
  if (attachments.length === 0) return; // nothing to send

  const body = `
    <p style="margin:0 0 16px">${uploaderLabel} has added ${attachments.length} document${attachments.length > 1 ? 's' : ''} to case <code>${caseId}</code> (${scenario}).</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:14px">
      ${attachments.map(a => `<li>${a.name}</li>`).join('')}
    </ul>
    <p style="font-size:13px;color:#64748b;margin:0">Files are attached to this email for download.</p>
  `;
  const html    = emailShell('Documents Uploaded', body);
  const subject = `People Action Check — Documents Added — Case ${caseId}`;

  const recipients = [managerEmail, hrEmail].filter(Boolean);
  if (recipients.length === 0) return;

  await sendEmail({ to: recipients, subject, html, attachments });
}

// Called when HR sends a message or follow-up to the manager.
async function notifyManagerOfHrReply({ managerEmail, caseId, scenario, message, hrNote = '' }) {
  if (!managerEmail) return;
  const html = emailShell('HR Follow-up', `
    <p style="margin:0 0 16px">HR has sent a message regarding case <code>${caseId}</code> (${scenario}).</p>
    <blockquote style="border-left:3px solid #e2e8f0;padding:10px 14px;margin:0 0 16px;color:#374151;font-size:14px">
      ${message.replace(/\n/g, '<br>')}
    </blockquote>
    ${hrNote ? `<p style="font-size:13px;color:#64748b">HR note: ${hrNote}</p>` : ''}
    <p style="font-size:13px;color:#64748b;margin:0">Respond in Slack via the People Action Check app.</p>
  `);
  await sendEmail({
    to:      managerEmail,
    subject: `People Action Check — HR Follow-up — Case ${caseId}`,
    html,
  });
}

// Called when manager replies to HR.
async function notifyHrOfManagerReply({ hrEmail, caseId, scenario, message }) {
  if (!hrEmail) return;
  const html = emailShell('Manager Reply', `
    <p style="margin:0 0 16px">The manager has replied on case <code>${caseId}</code> (${scenario}).</p>
    <blockquote style="border-left:3px solid #e2e8f0;padding:10px 14px;margin:0 0 16px;color:#374151;font-size:14px">
      ${message.replace(/\n/g, '<br>')}
    </blockquote>
    <p style="font-size:13px;color:#64748b;margin:0">Review in Slack via the PAC HR channel.</p>
  `);
  await sendEmail({
    to:      hrEmail,
    subject: `People Action Check — Manager Reply — Case ${caseId}`,
    html,
  });
}

module.exports = {
  sendEmail,
  downloadSlackFile,
  downloadSlackFiles,
  notifyManagerResult,
  notifyHrOfCase,
  notifyDocumentUploaded,
  notifyManagerOfHrReply,
  notifyHrOfManagerReply,
};
