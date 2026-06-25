import { describe, it, expect } from 'vitest';
import {
  CASE_STATES,
  ACTORS,
  createCase,
  transitionCase,
  isValidTransition,
  getAvailableTransitions,
} from '../../src/core/workflow.js';

describe('createCase', () => {
  it('creates a case in NOT_STARTED state', () => {
    const c = createCase({ id: 'test-1', scenario: 'Policy Violation', managerId: 'mgr@co.com', source: 'web' });
    expect(c.state).toBe(CASE_STATES.NOT_STARTED);
    expect(c.id).toBe('test-1');
    expect(c.auditLog).toHaveLength(0);
  });
});

describe('isValidTransition', () => {
  it('allows manager to start a web check', () => {
    expect(isValidTransition(CASE_STATES.NOT_STARTED, CASE_STATES.IN_PROGRESS_WEB, ACTORS.MANAGER)).toBe(true);
  });

  it('allows manager to start a Slack check', () => {
    expect(isValidTransition(CASE_STATES.NOT_STARTED, CASE_STATES.IN_PROGRESS_SLACK, ACTORS.MANAGER)).toBe(true);
  });

  it('allows HR to acknowledge a submitted case', () => {
    expect(isValidTransition(CASE_STATES.SUBMITTED, CASE_STATES.ACKNOWLEDGED, ACTORS.HR)).toBe(true);
  });

  it('does not allow manager to acknowledge a case', () => {
    expect(isValidTransition(CASE_STATES.SUBMITTED, CASE_STATES.ACKNOWLEDGED, ACTORS.MANAGER)).toBe(false);
  });

  it('does not allow skipping states', () => {
    expect(isValidTransition(CASE_STATES.NOT_STARTED, CASE_STATES.SUBMITTED, ACTORS.MANAGER)).toBe(false);
  });

  it('allows system to archive a closed case', () => {
    expect(isValidTransition(CASE_STATES.CLOSED, CASE_STATES.ARCHIVED, ACTORS.SYSTEM)).toBe(true);
  });
});

describe('transitionCase', () => {
  it('transitions state and appends audit log entry', () => {
    let c = createCase({ id: 'c1', scenario: 'Attendance Issue', managerId: 'mgr@co.com', source: 'web' });
    c = transitionCase(c, CASE_STATES.IN_PROGRESS_WEB, ACTORS.MANAGER);
    expect(c.state).toBe(CASE_STATES.IN_PROGRESS_WEB);
    expect(c.auditLog).toHaveLength(1);
    expect(c.auditLog[0].from).toBe(CASE_STATES.NOT_STARTED);
    expect(c.auditLog[0].to).toBe(CASE_STATES.IN_PROGRESS_WEB);
    expect(c.auditLog[0].actor).toBe(ACTORS.MANAGER);
  });

  it('throws on invalid transition', () => {
    const c = createCase({ id: 'c2', scenario: 'Policy Violation', managerId: 'mgr@co.com', source: 'slack' });
    expect(() => transitionCase(c, CASE_STATES.SUBMITTED, ACTORS.MANAGER)).toThrow();
  });

  it('does not mutate the original case record', () => {
    const original = createCase({ id: 'c3', scenario: 'Leave of Absence', managerId: 'mgr@co.com', source: 'web' });
    transitionCase(original, CASE_STATES.IN_PROGRESS_WEB, ACTORS.MANAGER);
    expect(original.state).toBe(CASE_STATES.NOT_STARTED);
  });

  it('accumulates multiple audit log entries', () => {
    let c = createCase({ id: 'c4', scenario: 'Termination Consideration', managerId: 'mgr@co.com', source: 'web' });
    c = transitionCase(c, CASE_STATES.IN_PROGRESS_WEB, ACTORS.MANAGER);
    c = transitionCase(c, CASE_STATES.SUBMITTED, ACTORS.MANAGER);
    c = transitionCase(c, CASE_STATES.ACKNOWLEDGED, ACTORS.HR);
    expect(c.auditLog).toHaveLength(3);
    expect(c.state).toBe(CASE_STATES.ACKNOWLEDGED);
  });
});

describe('getAvailableTransitions', () => {
  it('returns correct options for HR from SUBMITTED', () => {
    const options = getAvailableTransitions(CASE_STATES.SUBMITTED, ACTORS.HR);
    expect(options).toContain(CASE_STATES.ACKNOWLEDGED);
  });

  it('returns empty array when no transitions are available', () => {
    const options = getAvailableTransitions(CASE_STATES.ARCHIVED, ACTORS.MANAGER);
    expect(options).toHaveLength(0);
  });
});
