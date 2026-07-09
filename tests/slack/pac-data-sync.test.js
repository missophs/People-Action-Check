// Verifies that pac-data.js (CJS, used by Netlify functions) stays in sync
// with scenarios.js (ESM, canonical source of truth).
// This is a regression gate: if someone adds a scenario to one but not the other,
// or diverges question data, this test catches it.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import {
  SCENARIO_NAMES as ESM_NAMES,
  SCENARIO_QUESTIONS as ESM_QUESTIONS,
  NEXT_STEPS as ESM_NEXT_STEPS,
} from '../../src/core/scenarios.js';

const require = createRequire(import.meta.url);
const {
  SCENARIO_NAMES: CJS_NAMES,
  SCENARIO_QUESTIONS: CJS_QUESTIONS,
  NEXT_STEPS: CJS_NEXT_STEPS,
} = require('../../netlify/functions/lib/pac-data.js');

describe('pac-data.js / scenarios.js sync', () => {
  it('SCENARIO_NAMES length matches', () => {
    expect(CJS_NAMES).toHaveLength(ESM_NAMES.length);
  });

  it('SCENARIO_NAMES contains all same entries', () => {
    ESM_NAMES.forEach(name => {
      expect(CJS_NAMES, `CJS missing scenario: ${name}`).toContain(name);
    });
    CJS_NAMES.forEach(name => {
      expect(ESM_NAMES, `ESM missing scenario: ${name}`).toContain(name);
    });
  });

  it('SCENARIO_QUESTIONS has same scenario keys', () => {
    const esmKeys = Object.keys(ESM_QUESTIONS).sort();
    const cjsKeys = Object.keys(CJS_QUESTIONS).sort();
    expect(cjsKeys).toEqual(esmKeys);
  });

  it('every scenario has same number of questions in both', () => {
    ESM_NAMES.forEach(name => {
      const esmLen = (ESM_QUESTIONS[name] || []).length;
      const cjsLen = (CJS_QUESTIONS[name] || []).length;
      expect(cjsLen, `${name}: question count mismatch (ESM=${esmLen}, CJS=${cjsLen})`).toBe(esmLen);
    });
  });

  it('question text matches between ESM and CJS for each scenario', () => {
    ESM_NAMES.forEach(name => {
      const esmQs = ESM_QUESTIONS[name] || [];
      const cjsQs = CJS_QUESTIONS[name] || [];
      esmQs.forEach((q, i) => {
        expect(cjsQs[i]?.q, `${name}[${i}]: question text mismatch`).toBe(q.q);
      });
    });
  });

  it('question weights match between ESM and CJS', () => {
    ESM_NAMES.forEach(name => {
      const esmQs = ESM_QUESTIONS[name] || [];
      const cjsQs = CJS_QUESTIONS[name] || [];
      esmQs.forEach((q, i) => {
        expect(cjsQs[i]?.weight, `${name}[${i}]: weight mismatch`).toBe(q.weight);
      });
    });
  });

  it('critical flags match between ESM and CJS', () => {
    ESM_NAMES.forEach(name => {
      const esmQs = ESM_QUESTIONS[name] || [];
      const cjsQs = CJS_QUESTIONS[name] || [];
      esmQs.forEach((q, i) => {
        expect(cjsQs[i]?.critical, `${name}[${i}]: critical flag mismatch`).toBe(q.critical);
      });
    });
  });

  it('NEXT_STEPS keys match', () => {
    const esmKeys = Object.keys(ESM_NEXT_STEPS).sort();
    const cjsKeys = Object.keys(CJS_NEXT_STEPS).sort();
    expect(cjsKeys).toEqual(esmKeys);
  });

  it('NEXT_STEPS good/warn/risk arrays have same length', () => {
    ESM_NAMES.forEach(name => {
      const esmNs = ESM_NEXT_STEPS[name] || {};
      const cjsNs = CJS_NEXT_STEPS[name] || {};
      ['good', 'warn', 'risk'].forEach(tier => {
        expect(
          (cjsNs[tier] || []).length,
          `${name}.${tier}: next-steps count mismatch`
        ).toBe((esmNs[tier] || []).length);
      });
    });
  });
});
