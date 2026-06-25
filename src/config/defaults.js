// Default values for all configurable settings.
// Used when no admin has set a value yet.

// SECURITY NOTE: The default PIN is a known value. Enterprise deployments must
// force admins to change it on first login. This is a Phase 3 work item.
export const DEFAULT_ADMIN_PIN = '1234';

export const LIMITS = {
  HISTORY_MAX_ITEMS:        10,
  HR_SUBMISSIONS_MAX_ITEMS: 50,
  FOLLOWUP_DAYS:            30,
};

export const RISK_LEVEL_LABELS = {
  good:    'Low Risk',
  warn:    'Elevated Risk',
  risk:    'High Risk',
  neutral: 'In Progress',
};

export const RISK_LEVEL_COLORS = {
  good:    { bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)',  text: '#34d399', light: '#a7f3d0' },
  warn:    { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  text: '#fbbf24', light: '#fde68a' },
  risk:    { bg: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.3)', text: '#fb7185', light: '#fecdd3' },
  neutral: { bg: 'rgba(136,153,170,0.1)', border: 'rgba(136,153,170,0.3)', text: '#8899aa', light: '#cbd5e1' },
};
