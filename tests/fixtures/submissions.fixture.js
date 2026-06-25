// Shared test fixtures for case/submission-related tests

export const SAMPLE_CASE = {
  id: 'case-fixture-001',
  scenario: 'Policy Violation',
  managerId: 'manager@example.com',
  source: 'web',
};

export const SAMPLE_SUBMISSION = {
  caseId: 'case-fixture-001',
  scenario: 'Policy Violation',
  answers: ['yes', 'yes', 'no', 'yes', 'yes'],
  notes: ['', '', 'First offense, no prior history.', '', ''],
  score: { level: 'warn', hasCriticalFlag: false, ratio: 0.29, countYes: 4, countNo: 1, countUnknown: 0 },
  submittedBy: 'Manager Name',
  submittedAt: '2026-06-24T00:00:00.000Z',
};
