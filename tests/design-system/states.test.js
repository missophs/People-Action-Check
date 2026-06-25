import { describe, it, expect } from 'vitest';
import {
  RISK_STATES,
  WORKFLOW_STATES,
  ALERT_STATES,
  riskState,
  workflowState,
  alertForRisk,
} from '../../src/design-system/states.js';

describe('RISK_STATES', () => {
  it('defines all three risk levels', () => {
    expect(RISK_STATES.good).toBeDefined();
    expect(RISK_STATES.warn).toBeDefined();
    expect(RISK_STATES.risk).toBeDefined();
  });

  it('each risk state has required fields', () => {
    const required = ['level', 'label', 'slotLabel', 'emoji', 'color', 'bg', 'border', 'light', 'title', 'summary'];
    for (const [key, state] of Object.entries(RISK_STATES)) {
      for (const field of required) {
        expect(state[field], `RISK_STATES.${key}.${field}`).toBeDefined();
        expect(state[field].length, `RISK_STATES.${key}.${field} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('level field matches the key', () => {
    expect(RISK_STATES.good.level).toBe('good');
    expect(RISK_STATES.warn.level).toBe('warn');
    expect(RISK_STATES.risk.level).toBe('risk');
  });

  it('label text is human-readable', () => {
    expect(RISK_STATES.good.label).toBe('Low Risk');
    expect(RISK_STATES.warn.label).toBe('Elevated Risk');
    expect(RISK_STATES.risk.label).toBe('High Risk');
  });

  it('slotLabel strings are uppercase (safe for Slack mrkdwn)', () => {
    for (const [key, state] of Object.entries(RISK_STATES)) {
      expect(state.slotLabel, `RISK_STATES.${key}.slotLabel`).toBe(state.slotLabel.toUpperCase());
    }
  });

  it('colors are not duplicated across risk levels', () => {
    expect(RISK_STATES.good.color).not.toBe(RISK_STATES.warn.color);
    expect(RISK_STATES.warn.color).not.toBe(RISK_STATES.risk.color);
    expect(RISK_STATES.good.color).not.toBe(RISK_STATES.risk.color);
  });

  it('titles are distinct for each level', () => {
    const titles = Object.values(RISK_STATES).map(s => s.title);
    const unique = new Set(titles);
    expect(unique.size).toBe(3);
  });
});

describe('WORKFLOW_STATES', () => {
  const expectedStates = [
    'NOT_STARTED', 'IN_PROGRESS_WEB', 'IN_PROGRESS_SLACK',
    'SUBMITTED', 'ACKNOWLEDGED', 'UNDER_REVIEW', 'ESCALATED',
    'CLOSED', 'ARCHIVED',
  ];

  it('defines all workflow states', () => {
    for (const state of expectedStates) {
      expect(WORKFLOW_STATES[state], `WORKFLOW_STATES.${state}`).toBeDefined();
    }
  });

  it('each workflow state has required fields', () => {
    const required = ['state', 'label', 'emoji', 'color', 'bg', 'border'];
    for (const [key, state] of Object.entries(WORKFLOW_STATES)) {
      for (const field of required) {
        expect(state[field], `WORKFLOW_STATES.${key}.${field}`).toBeDefined();
      }
    }
  });

  it('state field matches the key', () => {
    for (const [key, state] of Object.entries(WORKFLOW_STATES)) {
      expect(state.state, `WORKFLOW_STATES.${key}.state`).toBe(key);
    }
  });

  it('ESCALATED uses the risk (red) color', () => {
    expect(WORKFLOW_STATES.ESCALATED.color).toMatch(/#fb7185|rgba\(251,113,133/);
  });
});

describe('ALERT_STATES', () => {
  it('defines all four alert types', () => {
    expect(ALERT_STATES.info).toBeDefined();
    expect(ALERT_STATES.success).toBeDefined();
    expect(ALERT_STATES.warning).toBeDefined();
    expect(ALERT_STATES.escalation).toBeDefined();
  });

  it('each alert state has required fields', () => {
    const required = ['type', 'label', 'emoji', 'color', 'bg', 'border', 'labelColor'];
    for (const [key, state] of Object.entries(ALERT_STATES)) {
      for (const field of required) {
        expect(state[field], `ALERT_STATES.${key}.${field}`).toBeDefined();
      }
    }
  });

  it('type field matches the key', () => {
    for (const [key, state] of Object.entries(ALERT_STATES)) {
      expect(state.type, `ALERT_STATES.${key}.type`).toBe(key);
    }
  });
});

describe('riskState()', () => {
  it('returns the correct state for each level', () => {
    expect(riskState('good').level).toBe('good');
    expect(riskState('warn').level).toBe('warn');
    expect(riskState('risk').level).toBe('risk');
  });

  it('falls back to good for unknown level', () => {
    expect(riskState('unknown').level).toBe('good');
    expect(riskState(undefined).level).toBe('good');
    expect(riskState(null).level).toBe('good');
  });
});

describe('workflowState()', () => {
  it('returns the correct state', () => {
    expect(workflowState('SUBMITTED').state).toBe('SUBMITTED');
    expect(workflowState('ESCALATED').state).toBe('ESCALATED');
  });

  it('falls back to NOT_STARTED for unknown state', () => {
    expect(workflowState('BOGUS').state).toBe('NOT_STARTED');
    expect(workflowState(undefined).state).toBe('NOT_STARTED');
  });
});

describe('alertForRisk()', () => {
  it('maps good → success', () => {
    expect(alertForRisk('good').type).toBe('success');
  });

  it('maps warn → warning', () => {
    expect(alertForRisk('warn').type).toBe('warning');
  });

  it('maps risk → escalation', () => {
    expect(alertForRisk('risk').type).toBe('escalation');
  });

  it('falls back to info for unknown level', () => {
    expect(alertForRisk('unknown').type).toBe('info');
    expect(alertForRisk(undefined).type).toBe('info');
  });
});
