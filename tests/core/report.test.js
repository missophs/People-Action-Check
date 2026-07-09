import { describe, it, expect } from 'vitest';
import {
  buildTextSummary,
  buildEmailSubject,
  buildReportTitle,
  RISK_LEVEL_LABELS,
} from '../../src/core/report.js';
import { LEVELS } from '../../src/core/scoring.js';

const QUESTIONS = [
  { q: 'Has performance been documented?', hint: '', weight: 2, critical: false },
  { q: 'Has HR been notified?',            hint: '', weight: 2, critical: true },
  { q: 'Is there prior history?',          hint: '', weight: 1, critical: false },
];

const SCORE_LOW  = { level: LEVELS.LOW,      hasCriticalFlag: false, ratio: 0 };
const SCORE_WARN = { level: LEVELS.ELEVATED,  hasCriticalFlag: false, ratio: 0.33 };
const SCORE_HIGH = { level: LEVELS.HIGH,      hasCriticalFlag: true,  ratio: 1 };

describe('RISK_LEVEL_LABELS', () => {
  it('maps all three scoring levels', () => {
    expect(RISK_LEVEL_LABELS[LEVELS.LOW]).toBe('Low Risk');
    expect(RISK_LEVEL_LABELS[LEVELS.ELEVATED]).toBe('Elevated Risk');
    expect(RISK_LEVEL_LABELS[LEVELS.HIGH]).toBe('High Risk');
  });

  it('maps neutral for in-progress state', () => {
    expect(RISK_LEVEL_LABELS['neutral']).toBe('In Progress');
  });
});

describe('buildTextSummary', () => {
  it('includes the scenario name in the header', () => {
    const text = buildTextSummary({
      scenario: 'Policy Violation',
      questions: QUESTIONS,
      answers: ['yes', 'yes', 'no'],
      notes: [],
      score: SCORE_LOW,
    });
    expect(text).toContain('Policy Violation');
    expect(text).toContain('People Action Check');
  });

  it('includes all question text', () => {
    const text = buildTextSummary({
      scenario: 'Policy Violation',
      questions: QUESTIONS,
      answers: ['yes', 'yes', 'no'],
      notes: [],
      score: SCORE_LOW,
    });
    QUESTIONS.forEach(q => {
      expect(text).toContain(q.q);
    });
  });

  it('renders Yes, No, and Don\'t know labels correctly', () => {
    const text = buildTextSummary({
      scenario: 'Policy Violation',
      questions: QUESTIONS,
      answers: ['yes', 'no', 'unknown'],
      notes: [],
      score: SCORE_WARN,
    });
    expect(text).toContain('Answer: Yes');
    expect(text).toContain('Answer: No');
    expect(text).toContain("Answer: Don't know");
  });

  it('marks critical questions with [Critical]', () => {
    const text = buildTextSummary({
      scenario: 'Policy Violation',
      questions: QUESTIONS,
      answers: ['yes', 'yes', 'yes'],
      notes: [],
      score: SCORE_LOW,
    });
    expect(text).toContain('[Critical]');
  });

  it('includes notes when provided', () => {
    const text = buildTextSummary({
      scenario: 'Policy Violation',
      questions: QUESTIONS,
      answers: ['yes', 'no', 'yes'],
      notes: ['', 'First offense only.', ''],
      score: SCORE_WARN,
    });
    expect(text).toContain('First offense only.');
  });

  it('omits note lines when notes array is empty', () => {
    const text = buildTextSummary({
      scenario: 'Policy Violation',
      questions: QUESTIONS,
      answers: ['yes', 'yes', 'yes'],
      notes: [],
      score: SCORE_LOW,
    });
    expect(text).not.toContain('Note:');
  });

  it('includes the risk level label', () => {
    const text = buildTextSummary({
      scenario: 'Termination Consideration',
      questions: QUESTIONS,
      answers: ['no', 'no', 'no'],
      notes: [],
      score: SCORE_HIGH,
    });
    expect(text).toContain('High Risk');
    expect(text).toContain('Critical flag: Yes');
  });

  it('does not include critical flag line for non-critical scores', () => {
    const text = buildTextSummary({
      scenario: 'Policy Violation',
      questions: QUESTIONS,
      answers: ['yes', 'yes', 'yes'],
      notes: [],
      score: SCORE_LOW,
    });
    expect(text).not.toContain('Critical flag');
  });
});

describe('buildEmailSubject', () => {
  it('includes scenario and risk level in subject', () => {
    const subject = buildEmailSubject({ scenario: 'Attendance Issue', level: LEVELS.LOW });
    expect(subject).toContain('Attendance Issue');
    expect(subject).toContain('Low Risk');
    expect(subject).toContain('People Action Check');
  });

  it('produces elevated risk subject', () => {
    const subject = buildEmailSubject({ scenario: 'Policy Violation', level: LEVELS.ELEVATED });
    expect(subject).toContain('Elevated Risk');
  });

  it('produces high risk subject', () => {
    const subject = buildEmailSubject({ scenario: 'Termination Consideration', level: LEVELS.HIGH });
    expect(subject).toContain('High Risk');
  });

  it('is a single-line string with no newlines', () => {
    const subject = buildEmailSubject({ scenario: 'Leave of Absence', level: LEVELS.LOW });
    expect(subject).not.toContain('\n');
  });
});

describe('buildReportTitle', () => {
  it('includes the scenario name', () => {
    const title = buildReportTitle('Interpersonal Conflict');
    expect(title).toContain('Interpersonal Conflict');
    expect(title).toContain('People Action Check');
  });

  it('returns a string', () => {
    expect(typeof buildReportTitle('Policy Violation')).toBe('string');
  });
});
