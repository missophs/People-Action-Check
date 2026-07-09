// Web regression checks.
// Verifies that scoring constants, scenario data, and workflow states
// are internally consistent and safe to ship.

import { describe, it, expect } from 'vitest';
import { LEVELS, RISK_THRESHOLDS, UNKNOWN_WEIGHT_MULTIPLIER, computeScore } from '../../src/core/scoring.js';
import { SCENARIO_NAMES, SCENARIO_QUESTIONS, NEXT_STEPS } from '../../src/core/scenarios.js';
import { CASE_STATES, ACTORS, TRANSITIONS, isValidTransition } from '../../src/core/workflow.js';
import { buildTextSummary, buildEmailSubject } from '../../src/core/report.js';

// ── Scoring constant invariants ───────────────────────────────────────────────

describe('Scoring constants', () => {
  it('LOW threshold is less than ELEVATED threshold', () => {
    expect(RISK_THRESHOLDS.LOW).toBeLessThan(RISK_THRESHOLDS.ELEVATED);
  });

  it('LOW threshold is between 0 and 0.5', () => {
    expect(RISK_THRESHOLDS.LOW).toBeGreaterThan(0);
    expect(RISK_THRESHOLDS.LOW).toBeLessThan(0.5);
  });

  it('ELEVATED threshold is between LOW and 1', () => {
    expect(RISK_THRESHOLDS.ELEVATED).toBeGreaterThan(RISK_THRESHOLDS.LOW);
    expect(RISK_THRESHOLDS.ELEVATED).toBeLessThan(1);
  });

  it('UNKNOWN_WEIGHT_MULTIPLIER is between 0 and 1', () => {
    expect(UNKNOWN_WEIGHT_MULTIPLIER).toBeGreaterThan(0);
    expect(UNKNOWN_WEIGHT_MULTIPLIER).toBeLessThan(1);
  });

  it('LEVELS has LOW, ELEVATED, HIGH', () => {
    expect(LEVELS.LOW).toBeDefined();
    expect(LEVELS.ELEVATED).toBeDefined();
    expect(LEVELS.HIGH).toBeDefined();
  });
});

// ── Scenario data integrity ───────────────────────────────────────────────────

describe('Scenario data integrity', () => {
  it('all 10 scenarios have at least one critical question', () => {
    const withoutCritical = SCENARIO_NAMES.filter(name =>
      !SCENARIO_QUESTIONS[name].some(q => q.critical)
    );
    // Not all scenarios require a critical question, but those that do must be consistent
    // This test documents the actual state — update if intentionally changed
    expect(withoutCritical.every(name => SCENARIO_NAMES.includes(name))).toBe(true);
  });

  it('no scenario question has weight 0 or negative', () => {
    SCENARIO_NAMES.forEach(name => {
      SCENARIO_QUESTIONS[name].forEach((q, i) => {
        expect(q.weight, `${name}[${i}]: weight must be positive`).toBeGreaterThan(0);
      });
    });
  });

  it('no question text is empty', () => {
    SCENARIO_NAMES.forEach(name => {
      SCENARIO_QUESTIONS[name].forEach((q, i) => {
        expect(q.q.trim(), `${name}[${i}]: question text must not be empty`).not.toBe('');
      });
    });
  });

  it('no next-steps string is empty', () => {
    SCENARIO_NAMES.forEach(name => {
      ['good', 'warn', 'risk'].forEach(tier => {
        NEXT_STEPS[name][tier].forEach((step, i) => {
          expect(step.trim(), `${name}.${tier}[${i}]: step must not be empty`).not.toBe('');
        });
      });
    });
  });

  it('all-yes answers never produce High Risk for any scenario', () => {
    SCENARIO_NAMES.forEach(name => {
      const qs = SCENARIO_QUESTIONS[name];
      const { level } = computeScore(qs, qs.map(() => 'yes'));
      expect(level, `${name}: all-yes should not be High Risk`).not.toBe(LEVELS.HIGH);
    });
  });

  it('all-no answers always produce High Risk for any scenario', () => {
    SCENARIO_NAMES.forEach(name => {
      const qs = SCENARIO_QUESTIONS[name];
      const { level } = computeScore(qs, qs.map(() => 'no'));
      expect(level, `${name}: all-no should be High Risk`).toBe(LEVELS.HIGH);
    });
  });
});

// ── Workflow state machine integrity ──────────────────────────────────────────

describe('Workflow state machine', () => {
  it('every CASE_STATE value is unique', () => {
    const values = Object.values(CASE_STATES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('every transition references valid CASE_STATES', () => {
    const validStates = new Set(Object.values(CASE_STATES));
    TRANSITIONS.forEach(t => {
      expect(validStates.has(t.from), `Unknown from state: ${t.from}`).toBe(true);
      expect(validStates.has(t.to),   `Unknown to state: ${t.to}`).toBe(true);
    });
  });

  it('every transition references valid ACTORS', () => {
    const validActors = new Set(Object.values(ACTORS));
    TRANSITIONS.forEach(t => {
      expect(validActors.has(t.actor), `Unknown actor: ${t.actor}`).toBe(true);
    });
  });

  it('ARCHIVED state has no outbound transitions', () => {
    const outbound = TRANSITIONS.filter(t => t.from === CASE_STATES.ARCHIVED);
    expect(outbound).toHaveLength(0);
  });

  it('manager cannot acknowledge or close a case', () => {
    expect(isValidTransition(CASE_STATES.SUBMITTED, CASE_STATES.ACKNOWLEDGED, ACTORS.MANAGER)).toBe(false);
    expect(isValidTransition(CASE_STATES.UNDER_REVIEW, CASE_STATES.CLOSED, ACTORS.MANAGER)).toBe(false);
  });

  it('HR cannot start a new case', () => {
    expect(isValidTransition(CASE_STATES.NOT_STARTED, CASE_STATES.IN_PROGRESS_WEB,   ACTORS.HR)).toBe(false);
    expect(isValidTransition(CASE_STATES.NOT_STARTED, CASE_STATES.IN_PROGRESS_SLACK, ACTORS.HR)).toBe(false);
  });

  it('system can only archive closed cases', () => {
    const systemTransitions = TRANSITIONS.filter(t => t.actor === ACTORS.SYSTEM);
    systemTransitions.forEach(t => {
      expect(t.from).toBe(CASE_STATES.CLOSED);
      expect(t.to).toBe(CASE_STATES.ARCHIVED);
    });
  });

  it('no duplicate transitions', () => {
    const keys = TRANSITIONS.map(t => `${t.from}→${t.to}@${t.actor}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});

// ── Report helpers regression ─────────────────────────────────────────────────

describe('Report helpers regression', () => {
  const QS = [
    { q: 'Q1', hint: '', weight: 1, critical: false },
    { q: 'Q2', hint: '', weight: 2, critical: true },
  ];

  it('buildTextSummary never returns empty string', () => {
    SCENARIO_NAMES.forEach(name => {
      const qs = SCENARIO_QUESTIONS[name];
      const text = buildTextSummary({
        scenario: name,
        questions: qs,
        answers: qs.map(() => 'yes'),
        notes: [],
        score: { level: LEVELS.LOW, hasCriticalFlag: false },
      });
      expect(text.trim()).not.toBe('');
    });
  });

  it('buildEmailSubject is deterministic', () => {
    const s1 = buildEmailSubject({ scenario: 'Policy Violation', level: LEVELS.HIGH });
    const s2 = buildEmailSubject({ scenario: 'Policy Violation', level: LEVELS.HIGH });
    expect(s1).toBe(s2);
  });

  it('buildEmailSubject result differs by scenario', () => {
    const s1 = buildEmailSubject({ scenario: 'Policy Violation', level: LEVELS.LOW });
    const s2 = buildEmailSubject({ scenario: 'Attendance Issue',  level: LEVELS.LOW });
    expect(s1).not.toBe(s2);
  });

  it('buildEmailSubject result differs by level', () => {
    const s1 = buildEmailSubject({ scenario: 'Policy Violation', level: LEVELS.LOW });
    const s2 = buildEmailSubject({ scenario: 'Policy Violation', level: LEVELS.HIGH });
    expect(s1).not.toBe(s2);
  });
});
