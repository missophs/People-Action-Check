// Regression: ESM scoring (src/core/scoring.js) and CJS scoring
// (netlify/functions/lib/pac-blocks.js computeScore) must produce
// identical results for all scenarios. This catches drift when thresholds
// or weight logic changes in one copy but not the other.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { computeScore as esmScore, LEVELS } from '../../src/core/scoring.js';
import { SCENARIO_NAMES, SCENARIO_QUESTIONS } from '../../src/core/scenarios.js';

const require = createRequire(import.meta.url);
const { computeScore: cjsScore } = require('../../netlify/functions/lib/pac-blocks.js');

function allAnswers(questions, value) {
  return questions.map(() => value);
}

function withCriticalNo(questions) {
  const critIdx = questions.findIndex(q => q.critical);
  if (critIdx === -1) return null;
  return questions.map((_, i) => (i === critIdx ? 'no' : 'yes'));
}

describe('Scoring parity: ESM vs CJS', () => {
  SCENARIO_NAMES.forEach(scenario => {
    const questions = SCENARIO_QUESTIONS[scenario];

    describe(scenario, () => {
      it('all-yes: both return Low Risk', () => {
        const answers = allAnswers(questions, 'yes');
        expect(esmScore(questions, answers).level).toBe(cjsScore(questions, answers).level);
        expect(esmScore(questions, answers).level).toBe(LEVELS.LOW);
      });

      it('all-no: both return High Risk', () => {
        const answers = allAnswers(questions, 'no');
        expect(esmScore(questions, answers).level).toBe(cjsScore(questions, answers).level);
        expect(esmScore(questions, answers).level).toBe(LEVELS.HIGH);
      });

      it('all-unknown: both return same level', () => {
        const answers = allAnswers(questions, 'unknown');
        const esmResult = esmScore(questions, answers);
        const cjsResult = cjsScore(questions, answers);
        expect(esmResult.level).toBe(cjsResult.level);
      });

      it('critical-no: both return High Risk (if critical exists)', () => {
        const answers = withCriticalNo(questions);
        if (!answers) return;
        expect(esmScore(questions, answers).level).toBe(LEVELS.HIGH);
        expect(cjsScore(questions, answers).level).toBe(LEVELS.HIGH);
      });

      it('ratio matches to 4 decimal places', () => {
        const answers = questions.map((_, i) => (i % 2 === 0 ? 'yes' : 'no'));
        const esmResult = esmScore(questions, answers);
        const cjsResult = cjsScore(questions, answers);
        expect(Math.abs(esmResult.ratio - cjsResult.ratio)).toBeLessThan(0.0001);
      });

      it('hasCriticalFlag matches', () => {
        const answers = allAnswers(questions, 'no');
        const esmResult = esmScore(questions, answers);
        const cjsResult = cjsScore(questions, answers);
        expect(esmResult.hasCriticalFlag).toBe(cjsResult.hasCriticalFlag);
      });
    });
  });
});

describe('Edge cases: scoring parity', () => {
  it('empty questions: both return Low Risk with ratio 0', () => {
    const esmResult = esmScore([], []);
    const cjsResult = cjsScore([], []);
    expect(esmResult.level).toBe(cjsResult.level);
    expect(esmResult.ratio).toBe(cjsResult.ratio);
  });

  it('unknown multiplier (0.75) applied identically', () => {
    const qs = [{ q: 'Q', hint: '', weight: 1, critical: false }];
    const esmResult = esmScore(qs, ['unknown']);
    const cjsResult = cjsScore(qs, ['unknown']);
    expect(Math.abs(esmResult.ratio - cjsResult.ratio)).toBeLessThan(0.0001);
  });
});
