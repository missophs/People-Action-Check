import { describe, it, expect } from 'vitest';
import {
  SCENARIO_NAMES,
  SCENARIO_META,
  SCENARIO_QUESTIONS,
  NEXT_STEPS,
  POLICY_CATEGORIES,
} from '../../src/core/scenarios.js';

describe('SCENARIO_NAMES', () => {
  it('contains exactly 10 scenarios', () => {
    expect(SCENARIO_NAMES).toHaveLength(10);
  });
});

describe('SCENARIO_META', () => {
  it('has an entry for every scenario name', () => {
    SCENARIO_NAMES.forEach(name => {
      expect(SCENARIO_META[name], `Missing meta for: ${name}`).toBeDefined();
    });
  });

  it('every entry has required fields', () => {
    SCENARIO_NAMES.forEach(name => {
      const meta = SCENARIO_META[name];
      expect(meta.icon,        `${name}: missing icon`).toBeDefined();
      expect(meta.riskLevel,   `${name}: missing riskLevel`).toBeDefined();
      expect(meta.riskLabel,   `${name}: missing riskLabel`).toBeDefined();
      expect(meta.description, `${name}: missing description`).toBeDefined();
      expect(Array.isArray(meta.examples), `${name}: examples must be array`).toBe(true);
      expect(Array.isArray(meta.docTips),  `${name}: docTips must be array`).toBe(true);
      expect(meta.watch,      `${name}: missing watch`).toBeDefined();
      expect(meta.contactHR,  `${name}: missing contactHR`).toBeDefined();
    });
  });
});

describe('SCENARIO_QUESTIONS', () => {
  it('has a question set for every scenario name', () => {
    SCENARIO_NAMES.forEach(name => {
      expect(SCENARIO_QUESTIONS[name], `Missing questions for: ${name}`).toBeDefined();
    });
  });

  it('every question has required fields with correct types', () => {
    SCENARIO_NAMES.forEach(name => {
      SCENARIO_QUESTIONS[name].forEach((q, i) => {
        expect(typeof q.q,        `${name}[${i}]: q must be string`).toBe('string');
        expect(typeof q.hint,     `${name}[${i}]: hint must be string`).toBe('string');
        expect(typeof q.weight,   `${name}[${i}]: weight must be number`).toBe('number');
        expect(typeof q.critical, `${name}[${i}]: critical must be boolean`).toBe('boolean');
        expect(q.weight,          `${name}[${i}]: weight must be > 0`).toBeGreaterThan(0);
      });
    });
  });

  it('critical questions have weight >= 2', () => {
    SCENARIO_NAMES.forEach(name => {
      SCENARIO_QUESTIONS[name].forEach((q, i) => {
        if (q.critical) {
          expect(q.weight, `${name}[${i}]: critical questions must have weight >= 2`).toBeGreaterThanOrEqual(2);
        }
      });
    });
  });

  it('every scenario has at least one question', () => {
    SCENARIO_NAMES.forEach(name => {
      expect(SCENARIO_QUESTIONS[name].length, `${name}: must have at least 1 question`).toBeGreaterThan(0);
    });
  });
});

describe('NEXT_STEPS', () => {
  it('has next steps for every scenario', () => {
    SCENARIO_NAMES.forEach(name => {
      expect(NEXT_STEPS[name], `Missing next steps for: ${name}`).toBeDefined();
    });
  });

  it('every scenario has good, warn, and risk arrays with 3 items each', () => {
    SCENARIO_NAMES.forEach(name => {
      const ns = NEXT_STEPS[name];
      expect(Array.isArray(ns.good), `${name}: good must be array`).toBe(true);
      expect(Array.isArray(ns.warn), `${name}: warn must be array`).toBe(true);
      expect(Array.isArray(ns.risk), `${name}: risk must be array`).toBe(true);
      expect(ns.good).toHaveLength(3);
      expect(ns.warn).toHaveLength(3);
      expect(ns.risk).toHaveLength(3);
    });
  });
});

describe('POLICY_CATEGORIES', () => {
  it('contains at least one category', () => {
    expect(POLICY_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('every category references only valid scenario names', () => {
    POLICY_CATEGORIES.forEach(cat => {
      cat.scenarios.forEach(name => {
        expect(SCENARIO_NAMES, `Category "${cat.id}" references unknown scenario: ${name}`)
          .toContain(name);
      });
    });
  });
});
