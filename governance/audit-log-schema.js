// Audit log entry schema.
// Every state transition on a case record appends one of these entries.
// High Risk cases will also write entries to Netlify Blobs (Phase 3 — immutable).

/**
 * @typedef {Object} AuditEntry
 * @property {string} from        - Previous case state (CASE_STATES value)
 * @property {string} to          - New case state (CASE_STATES value)
 * @property {string} actor       - Who triggered the transition (ACTORS value)
 * @property {string} timestamp   - ISO 8601 timestamp
 * @property {string} [actorId]   - User ID of the actor (manager email, Slack user ID, etc.)
 * @property {string} [channel]   - Surface where the action was taken: 'web' | 'slack'
 * @property {string} [note]      - Optional free-text note (HR response, escalation reason, etc.)
 * @property {string} [slackTs]   - Slack message timestamp (for thread linkback)
 */

export const AUDIT_ENTRY_SCHEMA = {
  required: ['from', 'to', 'actor', 'timestamp'],
  optional: ['actorId', 'channel', 'note', 'slackTs'],
};

/**
 * @typedef {Object} CaseAuditRecord
 * @property {string}       caseId     - Unique case identifier
 * @property {string}       scenario   - Scenario name
 * @property {string}       riskLevel  - Final risk level at submission
 * @property {boolean}      critFlag   - Whether a critical question was flagged
 * @property {string}       submittedAt - ISO 8601 timestamp of submission
 * @property {string}       source     - 'web' | 'slack'
 * @property {AuditEntry[]} log        - Ordered list of state transitions
 */

// Phase 3: High Risk cases will write CaseAuditRecord to Netlify Blobs at:
//   pac/audit/<caseId>/record.json
// These records are write-once (immutable after creation).
export const IMMUTABLE_AUDIT_STATUS = 'pending-phase-3';
