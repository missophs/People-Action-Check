// Scoring / risk logic — canonical source of truth for PAC risk calculation.
// Used by web app, Slack plugin, and Netlify functions.
// Changes to thresholds or weights are code-controlled (not admin-configurable).
// See src/config/governance.config.js.

export const ANSWERS = {
  YES: 'yes',
  NO: 'no',
  UNKNOWN: 'unknown',
};

export const LEVELS = {
  LOW: 'good',
  ELEVATED: 'warn',
  HIGH: 'risk',
};

// Weighted ratio thresholds — changing these requires code review
export const RISK_THRESHOLDS = {
  LOW: 0.15,      // weighted ratio <= 15% → Low Risk
  ELEVATED: 0.45, // 16–45% → Elevated Risk
                  // > 45% → High Risk
};

// Weight multiplier applied to "Don't Know" answers
export const UNKNOWN_WEIGHT_MULTIPLIER = 0.75;

/**
 * Compute the risk score for a completed check.
 *
 * @param {Array<{weight: number, critical: boolean}>} questions
 * @param {Array<'yes'|'no'|'unknown'>} answers  - same length as questions
 * @returns {{ level: string, hasCriticalFlag: boolean, ratio: number,
 *             countYes: number, countNo: number, countUnknown: number,
 *             totalWeight: number, weightedNo: number }}
 */
export function computeScore(questions, answers) {
  let weightedNo = 0;
  let totalWeight = 0;
  let hasCriticalFlag = false;
  let countUnknown = 0;
  let countYes = 0;
  let countNo = 0;

  questions.forEach((item, i) => {
    const answer = answers[i];
    totalWeight += item.weight;

    if (answer === ANSWERS.YES) {
      countYes++;
    } else if (answer === ANSWERS.NO) {
      countNo++;
      weightedNo += item.weight;
      if (item.critical) hasCriticalFlag = true;
    } else if (answer === ANSWERS.UNKNOWN) {
      countUnknown++;
      weightedNo += item.weight * UNKNOWN_WEIGHT_MULTIPLIER;
      if (item.critical) hasCriticalFlag = true;
    }
  });

  const ratio = totalWeight > 0 ? weightedNo / totalWeight : 0;

  const level = hasCriticalFlag
    ? LEVELS.HIGH
    : ratio <= RISK_THRESHOLDS.LOW
    ? LEVELS.LOW
    : ratio <= RISK_THRESHOLDS.ELEVATED
    ? LEVELS.ELEVATED
    : LEVELS.HIGH;

  return { level, hasCriticalFlag, ratio, countYes, countNo, countUnknown, totalWeight, weightedNo };
}

/**
 * Returns true if all questions have been answered.
 */
export function isComplete(answers, questionCount) {
  return answers.filter(a => a !== null && a !== undefined).length === questionCount;
}

/**
 * Compute a live (partial) risk level as questions are answered.
 * Returns 'neutral' until at least one answer is given.
 */
export function computeLiveLevel(questions, answers) {
  const answered = answers.filter(a => a !== null && a !== undefined);
  if (answered.length === 0) return 'neutral';
  return computeScore(questions, answers).level;
}
