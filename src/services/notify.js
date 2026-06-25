// Notification service — Slack Block Kit and Teams MessageCard payload builders,
// plus the relay call to /api/notify.
// Governance: webhook URLs are admin-configurable (stored in localStorage).
// Payload structure is code-controlled.

import { LEVELS } from '../core/scoring.js';

const LEVEL_COLORS = {
  [LEVELS.LOW]:      '#34d399',
  [LEVELS.ELEVATED]: '#fbbf24',
  [LEVELS.HIGH]:     '#fb7185',
};

const LEVEL_LABELS = {
  [LEVELS.LOW]:      'Low Risk',
  [LEVELS.ELEVATED]: 'Elevated Risk',
  [LEVELS.HIGH]:     'High Risk',
};

/**
 * Build a Slack Block Kit notification payload for a submitted check.
 * Action IDs follow the convention: pac_notify_<action> (see governance/naming-conventions.md)
 */
export function buildSlackPayload({ scenario, riskLevel, submittedBy, caseId, webUrl }) {
  const label = LEVEL_LABELS[riskLevel] || riskLevel;
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'People Action Check Submitted', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Scenario:*\n${scenario}` },
        { type: 'mrkdwn', text: `*Risk Level:*\n${label}` },
        ...(submittedBy ? [{ type: 'mrkdwn', text: `*Submitted by:*\n${submittedBy}` }] : []),
        ...(caseId ? [{ type: 'mrkdwn', text: `*Case ID:*\n${caseId}` }] : []),
      ],
    },
  ];

  if (webUrl) {
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: 'View Full Check' },
        url: webUrl,
        action_id: 'pac_notify_view_case',
      }],
    });
  }

  return { blocks };
}

/**
 * Build a Teams MessageCard payload for a submitted check.
 */
export function buildTeamsPayload({ scenario, riskLevel, submittedBy }) {
  const label = LEVEL_LABELS[riskLevel] || riskLevel;
  const color = LEVEL_COLORS[riskLevel] || '#888888';
  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: color.replace('#', ''),
    summary: `People Action Check — ${scenario}`,
    sections: [{
      activityTitle: `People Action Check — ${scenario}`,
      facts: [
        { name: 'Risk Level', value: label },
        ...(submittedBy ? [{ name: 'Submitted by', value: submittedBy }] : []),
      ],
    }],
  };
}

/**
 * Send a notification via the /api/notify relay.
 * webhookUrl determines whether Slack or Teams format is used by the caller.
 */
export async function sendNotification(webhookUrl, payload) {
  if (!webhookUrl) return;
  const res = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl, payload }),
  });
  if (!res.ok) throw new Error(`Notify relay failed: ${res.status}`);
  return res.json();
}
