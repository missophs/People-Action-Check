// Shared test fixtures for scenario-related tests

export const SAMPLE_QUESTIONS = [
  { q: 'Has the issue been documented?', hint: 'Check your records.', weight: 2, critical: false },
  { q: 'Has HR been notified?',          hint: 'Required for this scenario.', weight: 2, critical: true },
  { q: 'Is there prior discipline history?', hint: 'Review the file.', weight: 1, critical: false },
];

export const ALL_YES    = ['yes', 'yes', 'yes'];
export const ALL_NO     = ['no', 'no', 'no'];
export const ALL_UNKNOWN = ['unknown', 'unknown', 'unknown'];
export const CRITICAL_NO = ['yes', 'no', 'yes'];     // critical question answered no → High Risk
export const PARTIAL     = ['yes', null, null];       // incomplete check
