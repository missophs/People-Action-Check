// Case workflow state model.
// Defines all valid states, who can trigger each transition, and helpers
// for creating and advancing case records.
// State transitions are code-controlled — not admin-configurable.

export const CASE_STATES = {
  NOT_STARTED:       'NOT_STARTED',
  IN_PROGRESS_WEB:   'IN_PROGRESS_WEB',
  IN_PROGRESS_SLACK: 'IN_PROGRESS_SLACK',
  SUBMITTED:         'SUBMITTED',
  ACKNOWLEDGED:      'ACKNOWLEDGED',
  UNDER_REVIEW:      'UNDER_REVIEW',
  ESCALATED:         'ESCALATED',
  CLOSED:            'CLOSED',
  ARCHIVED:          'ARCHIVED',
};

export const ACTORS = {
  MANAGER: 'manager',
  HR:      'hr',
  SYSTEM:  'system',
};

export const SOURCES = {
  WEB:   'web',
  SLACK: 'slack',
};

// All valid state transitions with the actor who may trigger them
export const TRANSITIONS = [
  { from: CASE_STATES.NOT_STARTED,       to: CASE_STATES.IN_PROGRESS_WEB,   actor: ACTORS.MANAGER },
  { from: CASE_STATES.NOT_STARTED,       to: CASE_STATES.IN_PROGRESS_SLACK, actor: ACTORS.MANAGER },
  { from: CASE_STATES.IN_PROGRESS_WEB,   to: CASE_STATES.SUBMITTED,         actor: ACTORS.MANAGER },
  { from: CASE_STATES.IN_PROGRESS_SLACK, to: CASE_STATES.SUBMITTED,         actor: ACTORS.MANAGER },
  { from: CASE_STATES.SUBMITTED,         to: CASE_STATES.ACKNOWLEDGED,      actor: ACTORS.HR      },
  { from: CASE_STATES.ACKNOWLEDGED,      to: CASE_STATES.UNDER_REVIEW,      actor: ACTORS.HR      },
  { from: CASE_STATES.ACKNOWLEDGED,      to: CASE_STATES.ESCALATED,         actor: ACTORS.HR      },
  { from: CASE_STATES.ACKNOWLEDGED,      to: CASE_STATES.CLOSED,            actor: ACTORS.HR      },
  { from: CASE_STATES.UNDER_REVIEW,      to: CASE_STATES.ESCALATED,         actor: ACTORS.HR      },
  { from: CASE_STATES.UNDER_REVIEW,      to: CASE_STATES.CLOSED,            actor: ACTORS.HR      },
  { from: CASE_STATES.ESCALATED,         to: CASE_STATES.CLOSED,            actor: ACTORS.HR      },
  { from: CASE_STATES.CLOSED,            to: CASE_STATES.ARCHIVED,          actor: ACTORS.SYSTEM  },
];

export function isValidTransition(from, to, actor) {
  return TRANSITIONS.some(t => t.from === from && t.to === to && t.actor === actor);
}

export function getAvailableTransitions(currentState, actor) {
  return TRANSITIONS
    .filter(t => t.from === currentState && t.actor === actor)
    .map(t => t.to);
}

/**
 * Create a new case record.
 * @param {{ id: string, scenario: string, managerId: string, source: string }} params
 */
export function createCase({ id, scenario, managerId, source }) {
  const now = new Date().toISOString();
  return {
    id,
    scenario,
    managerId,
    source,
    state: CASE_STATES.NOT_STARTED,
    createdAt: now,
    updatedAt: now,
    auditLog: [],
  };
}

/**
 * Advance a case to a new state, appending an audit log entry.
 * Throws if the transition is not valid.
 */
export function transitionCase(caseRecord, to, actor, meta = {}) {
  if (!isValidTransition(caseRecord.state, to, actor)) {
    throw new Error(`Invalid transition: ${caseRecord.state} → ${to} by ${actor}`);
  }
  const entry = {
    from: caseRecord.state,
    to,
    actor,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  return {
    ...caseRecord,
    state: to,
    updatedAt: entry.timestamp,
    auditLog: [...caseRecord.auditLog, entry],
  };
}
