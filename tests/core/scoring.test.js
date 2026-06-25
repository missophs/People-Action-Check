import { describe, it, expect } from 'vitest';
import { computeScore, computeLiveLevel, isComplete, LEVELS, ANSWERS, RISK_THRESHOLDS } from '../../src/core/scoring.js';

const stdQ  = { weight: 1, critical: false };
const critQ = { weight: 2, critical: true };
const heavyQ = { weight: 2, critical: false };

describe('computeScore', () => {
  it('returns Low Risk when all answers are yes', () => {
    const questions = [stdQ, stdQ, stdQ];
    const answers   = ['yes', 'yes', 'yes'];
    const result = computeScore(questions, answers);
    expect(result.level).toBe(LEVELS.LOW);
    expect(result.hasCriticalFlag).toBe(false);
    expect(result.weightedNo).toBe(0);
  });

  it('returns High Risk when any critical question is answered no', () => {
    const questions = [stdQ, critQ, stdQ];
    const answers   = ['yes', 'no', 'yes'];
    const result = computeScore(questions, answers);
    expect(result.level).toBe(LEVELS.HIGH);
    expect(result.hasCriticalFlag).toBe(true);
  });

  it('returns High Risk when any critical question is answered unknown', () => {
    const questions = [stdQ, critQ];
    const answers   = ['yes', 'unknown'];
    const result = computeScore(questions, answers);
    expect(result.level).toBe(LEVELS.HIGH);
    expect(result.hasCriticalFlag).toBe(true);
  });

  it('returns Elevated Risk when weighted ratio is between 16% and 45%', () => {
    // 2 yes (weight 1 each) + 1 no (weight 1) → ratio = 1/3 ≈ 0.33
    const questions = [stdQ, stdQ, stdQ];
    const answers   = ['yes', 'yes', 'no'];
    const result = computeScore(questions, answers);
    expect(result.level).toBe(LEVELS.ELEVATED);
    expect(result.ratio).toBeCloseTo(1 / 3);
  });

  it('returns High Risk when weighted ratio exceeds 45%', () => {
    // 1 yes (weight 1) + 2 no (weight 1 each) → ratio = 2/3 ≈ 0.67
    const questions = [stdQ, stdQ, stdQ];
    const answers   = ['yes', 'no', 'no'];
    const result = computeScore(questions, answers);
    expect(result.level).toBe(LEVELS.HIGH);
  });

  it('applies 0.75x weight multiplier to unknown answers', () => {
    const questions = [stdQ]; // weight 1
    const answers   = ['unknown'];
    const result = computeScore(questions, answers);
    expect(result.weightedNo).toBeCloseTo(0.75);
  });

  it('counts yes, no, and unknown correctly', () => {
    const questions = [stdQ, stdQ, stdQ, stdQ];
    const answers   = ['yes', 'no', 'unknown', 'yes'];
    const result = computeScore(questions, answers);
    expect(result.countYes).toBe(2);
    expect(result.countNo).toBe(1);
    expect(result.countUnknown).toBe(1);
  });

  it('handles all unknown answers without crashing', () => {
    const questions = [stdQ, stdQ];
    const answers   = ['unknown', 'unknown'];
    const result = computeScore(questions, answers);
    expect(result.level).toBeDefined();
    expect(result.ratio).toBeGreaterThan(0);
  });

  it('handles empty questions array', () => {
    const result = computeScore([], []);
    expect(result.level).toBe(LEVELS.LOW);
    expect(result.ratio).toBe(0);
  });

  it('uses RISK_THRESHOLDS constants correctly', () => {
    // Ratio at exactly LOW threshold
    const questions = Array(20).fill(stdQ); // total weight 20
    const noCount = Math.round(RISK_THRESHOLDS.LOW * 20); // 3 nos → ratio = 0.15
    const answers = Array(20).fill('yes').fill('no', 0, noCount);
    const result = computeScore(questions, answers);
    expect(result.level).toBe(LEVELS.LOW);
  });
});

describe('isComplete', () => {
  it('returns true when all questions are answered', () => {
    expect(isComplete(['yes', 'no', 'unknown'], 3)).toBe(true);
  });

  it('returns false when some questions are unanswered', () => {
    expect(isComplete(['yes', null, 'unknown'], 3)).toBe(false);
  });

  it('returns false for empty answers', () => {
    expect(isComplete([], 3)).toBe(false);
  });
});

describe('computeLiveLevel', () => {
  it('returns neutral when no answers given', () => {
    expect(computeLiveLevel([stdQ, stdQ], [null, null])).toBe('neutral');
  });

  it('returns a valid level once at least one answer is given', () => {
    const level = computeLiveLevel([stdQ, stdQ], ['yes', null]);
    expect(['good', 'warn', 'risk', 'neutral']).toContain(level);
  });
});
