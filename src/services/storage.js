// Storage abstraction — localStorage key constants and helpers, plus server-synced values.
// All localStorage keys are defined here. Nothing outside this module should hardcode a key.

export const STORAGE_KEYS = {
  SESSION:        'hr_check_session_v3',
  HISTORY:        'hr_check_history_v1',
  POLICIES:       'hr_check_policies_v3',
  PIN:            'hr_check_pin_v3',
  HR_EMAIL:       'hr_check_hr_email_v1',
  SLACK_WEBHOOK:  'hr_check_webhook_slack_v1',
  TEAMS_WEBHOOK:  'hr_check_webhook_teams_v1',
  HR_SUBMISSIONS: 'hr_check_hr_submissions_v1',
  FOLLOWUPS:      'hr_check_followups_v1',
};

export const local = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};

// Server-synced HR email (Netlify Blobs via /api/get-hr-email and /api/save-hr-email)
export async function fetchHrEmail() {
  const res = await fetch('/api/get-hr-email');
  if (!res.ok) throw new Error('get-hr-email fetch failed');
  const { hrEmail } = await res.json();
  return hrEmail || '';
}

export async function saveHrEmailToServer(email) {
  const res = await fetch('/api/save-hr-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hrEmail: email }),
  });
  if (!res.ok) throw new Error('save-hr-email failed');
}
