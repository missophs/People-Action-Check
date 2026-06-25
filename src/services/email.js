// Email service — wraps /api/send-report-email (Brevo relay).
// The API key never touches the browser; this module only calls the Netlify Function relay.

/**
 * Send an email with optional attachments via the Brevo relay.
 * @param {{ to: string, subject: string, text: string, attachments?: Array<{filename: string, base64Content: string}> }} params
 */
export async function sendEmail({ to, subject, text, attachments = [] }) {
  const res = await fetch('/api/send-report-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, text, attachments }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Email relay failed: ${res.status}`);
  }
  return res.json();
}
