// Report generation helpers — text summary, email subject, and docx scaffold.
// Full docx generation currently lives in index.html (requires the `docx` CDN library).
// That logic will migrate here in Phase 3 once the Vite build pipeline is in place.

import { LEVELS } from './scoring.js';

export const RISK_LEVEL_LABELS = {
  [LEVELS.LOW]:      'Low Risk',
  [LEVELS.ELEVATED]: 'Elevated Risk',
  [LEVELS.HIGH]:     'High Risk',
  neutral:           'In Progress',
};

/**
 * Build a plain-text summary of a completed check.
 * Used for email body and clipboard copy.
 */
export function buildTextSummary({ scenario, questions, answers, notes, score }) {
  const lines = [`People Action Check — ${scenario}`, ''];

  questions.forEach((item, i) => {
    const answer = answers[i];
    const label = answer === 'yes' ? 'Yes' : answer === 'no' ? 'No' : "Don't know";
    lines.push(`Q${i + 1}${item.critical ? ' [Critical]' : ''}: ${item.q}`);
    lines.push(`  Answer: ${label}`);
    if (notes && notes[i]) lines.push(`  Note: ${notes[i]}`);
    lines.push('');
  });

  lines.push(`Risk Level: ${RISK_LEVEL_LABELS[score.level] || score.level}`);
  if (score.hasCriticalFlag) lines.push('Critical flag: Yes');
  return lines.join('\n');
}

/**
 * Build the email subject line for a submitted check.
 */
export function buildEmailSubject({ scenario, level }) {
  return `People Action Check — ${scenario} — ${RISK_LEVEL_LABELS[level] || level}`;
}

/**
 * Build the report title shown in the docx and on the result screen.
 */
export function buildReportTitle(scenario) {
  return `People Action Check — ${scenario}`;
}

// docx generation is currently inline in index.html.
// Extraction to this module is planned for Phase 3.
export const DOCX_EXTRACTION_STATUS = 'pending-phase-3';
