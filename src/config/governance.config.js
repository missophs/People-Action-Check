// Governance boundary — defines what is admin-configurable vs. code-controlled.
// This file is the canonical reference for PAC configuration ownership.
// Any new configurable item must be documented here before being implemented.

export const GOVERNANCE = {
  // Admin-configurable: can be changed by an authorized admin without a code deployment.
  adminConfigurable: {
    hrEmail: {
      description: 'HR recipient email address for submitted checks',
      storage: 'netlify-blobs',
      auth: 'pin-gated',
      api: { read: '/api/get-hr-email', write: '/api/save-hr-email' },
    },
    slackWebhook: {
      description: 'Slack incoming webhook URL for HR notifications',
      storage: 'localStorage',
      auth: 'pin-gated',
      note: 'Migrate to server-side config in Phase 3 so it is org-wide, not per-browser.',
    },
    teamsWebhook: {
      description: 'Teams incoming webhook URL for HR notifications',
      storage: 'localStorage',
      auth: 'pin-gated',
      note: 'Migrate to server-side config in Phase 3.',
    },
    policyDocuments: {
      description: 'Company policy documents shown in the scenario policy library',
      storage: 'localStorage',
      auth: 'pin-gated',
      note: 'Migrate to server-side config in Phase 3 so documents are org-wide.',
    },
    adminPin: {
      description: 'PIN for accessing admin settings and the policy library',
      storage: 'localStorage-hashed-sha256',
      auth: 'self',
      securityNote: 'Default PIN (1234) must be force-changed on first admin login. Phase 3 work item.',
    },
  },

  // Code-controlled: requires a code change + pull request to modify.
  codeControlled: {
    scenarioDefinitions:  'src/core/scenarios.js → SCENARIO_META, SCENARIO_QUESTIONS',
    nextStepsContent:     'src/core/scenarios.js → NEXT_STEPS',
    scoringLogic:         'src/core/scoring.js → computeScore',
    riskThresholds:       'src/core/scoring.js → RISK_THRESHOLDS',
    workflowStates:       'src/core/workflow.js → CASE_STATES, TRANSITIONS',
    slackActionIds:       'src/slack/builders/ — follow naming-conventions.md',
    uiDesignTokens:       'src/config/tokens.js (Phase 3)',
  },

  // Planned for Phase 3
  phase3: {
    slackAppConfig:       'PAC_SLACK_BOT_TOKEN, PAC_SLACK_SIGNING_SECRET — env vars, never in code',
    auditLog:             'Immutable audit entries for High Risk cases on submission',
    serverSideWebhooks:   'Migrate Slack/Teams webhook URLs from localStorage to Netlify Blobs',
    serverSidePolicies:   'Migrate policy documents from localStorage to Netlify Blobs',
    forceDefaultPinChange: 'Block admin access until default PIN is changed',
  },
};
