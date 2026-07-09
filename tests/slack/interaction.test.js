// Slack interaction flow tests — manager → HR → manager communication loop.
// Pure logic only; no actual Slack API calls.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  computeScore,
  resultDmMessage,
  hrTriageMessage,
  questionsModal,
  intakeModal,
  managerFollowupMessage,
  hrReplyModal,
  managerReplyModal,
  hrResolveModal,
} = require('../../netlify/functions/lib/pac-blocks.js');
const { SCENARIO_NAMES, SCENARIO_QUESTIONS } = require('../../netlify/functions/lib/pac-data.js');

// ── Manager flow ──────────────────────────────────────────────────────────────

describe('Manager flow: intake → questions → result', () => {
  it('intake modal has multi_static_select for scenario selection', () => {
    const m = intakeModal();
    const block = m.blocks.find(b => b.block_id === 'pac_block_scenario');
    expect(block.element.type).toBe('multi_static_select');
  });

  it('questionsModal renders for every scenario without throwing', () => {
    SCENARIO_NAMES.forEach(name => {
      const qs = SCENARIO_QUESTIONS[name];
      const meta = JSON.stringify({ caseId: 'test', scenario: name, refName: '', managerId: 'U1' });
      expect(() => questionsModal(name, qs, meta)).not.toThrow();
    });
  });

  it('questionsModal private_metadata has required fields', () => {
    const meta = JSON.stringify({ caseId: 'c123', scenario: 'Policy Violation', refName: 'JD', managerId: 'U1' });
    const m = questionsModal('Policy Violation', SCENARIO_QUESTIONS['Policy Violation'], meta);
    const parsed = JSON.parse(m.private_metadata);
    expect(parsed.caseId).toBeDefined();
    expect(parsed.scenario).toBeDefined();
    expect(parsed.managerId).toBeDefined();
  });

  it('all-yes on any scenario → Low Risk result DM (#34d399 border)', () => {
    SCENARIO_NAMES.forEach(name => {
      const qs = SCENARIO_QUESTIONS[name];
      const { level } = computeScore(qs, qs.map(() => 'yes'));
      expect(level).toBe('good');
      expect(resultDmMessage({ scenario: name, level, caseId: 'c1' }).attachments[0].color).toBe('#34d399');
    });
  });

  it('critical-no on any scenario → High Risk result DM (#f43f5e border)', () => {
    SCENARIO_NAMES.forEach(name => {
      const qs = SCENARIO_QUESTIONS[name];
      const critIdx = qs.findIndex(q => q.critical);
      if (critIdx === -1) return;
      const answers = qs.map((_, i) => (i === critIdx ? 'no' : 'yes'));
      const { level } = computeScore(qs, answers);
      expect(level).toBe('risk');
      expect(resultDmMessage({ scenario: name, level, caseId: 'c1' }).attachments[0].color).toBe('#f43f5e');
    });
  });

  it('Notify HR button value is the caseId (requires refName)', () => {
    const msg = resultDmMessage({ scenario: 'Policy Violation', level: 'warn', caseId: 'pac_abc123', hrNotified: false, refName: 'EE-123' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    const notifyBtn = actions.elements.find(e => e.action_id === 'pac_result_notify_hr');
    expect(notifyBtn.value).toBe('pac_abc123');
  });

  it('self-check: no refName → no Notify HR button', () => {
    const msg = resultDmMessage({ scenario: 'Policy Violation', level: 'risk', caseId: 'c1' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    expect(actions.elements.find(e => e.action_id === 'pac_result_notify_hr')).toBeUndefined();
  });

  it('multiple selected scenarios all appear in result DM', () => {
    const msg = resultDmMessage({
      scenario: 'Performance Decline',
      scenarios: ['Performance Decline', 'Attendance Issue', 'Policy Violation'],
      level: 'warn', caseId: 'c1',
    });
    const json = JSON.stringify(msg.attachments[0].blocks);
    expect(json).toContain('Performance Decline');
    expect(json).toContain('Attendance Issue');
    expect(json).toContain('Policy Violation');
  });
});

// ── HR triage flow ────────────────────────────────────────────────────────────

describe('HR triage flow', () => {
  const BASE = {
    scenario: 'Termination Consideration',
    level: 'risk',
    caseId: 'pac_triage_001',
    managerSlackId: 'U_MGR',
    submittedAt: '2026-06-28T14:00:00.000Z',
  };

  it('SUBMITTED: primary action is Acknowledge', () => {
    const msg = hrTriageMessage({ ...BASE, state: 'SUBMITTED' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    const primary = actions.elements.find(e => e.style === 'primary');
    expect(primary.text.text).toMatch(/Acknowledge/i);
  });

  it('UNDER_REVIEW: primary action is Resolve', () => {
    const msg = hrTriageMessage({ ...BASE, state: 'UNDER_REVIEW', claimedBy: 'U_HR' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    const primary = actions.elements.find(e => e.style === 'primary');
    expect(primary.text.text).toMatch(/Resolve/i);
  });

  it('ESCALATED: primary action is Close', () => {
    const msg = hrTriageMessage({ ...BASE, state: 'ESCALATED' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    const primary = actions.elements.find(e => e.style === 'primary');
    expect(primary.text.text).toMatch(/Close/i);
  });

  it('all overflow option values include caseId', () => {
    const actions = hrTriageMessage(BASE).attachments[0].blocks.find(b => b.type === 'actions');
    const overflow = actions.elements.find(e => e.type === 'overflow');
    overflow.options.forEach(opt => expect(opt.value).toContain('pac_triage_001'));
  });

  it('overflow option values follow pac_hr_<action>::<caseId> format', () => {
    const actions = hrTriageMessage(BASE).attachments[0].blocks.find(b => b.type === 'actions');
    const overflow = actions.elements.find(e => e.type === 'overflow');
    overflow.options.forEach(opt => {
      const [action, id] = opt.value.split('::');
      expect(action).toMatch(/^pac_hr_/);
      expect(id).toBe('pac_triage_001');
    });
  });

  it('SUBMITTED overflow includes claim option (not escalate — escalate is ACKNOWLEDGED/UNDER_REVIEW only)', () => {
    const actions = hrTriageMessage({ ...BASE, state: 'SUBMITTED' }).attachments[0].blocks.find(b => b.type === 'actions');
    const overflow = actions.elements.find(e => e.type === 'overflow');
    expect(overflow.options.some(o => o.value.includes('claim'))).toBe(true);
    expect(overflow.options.some(o => o.value.includes('escalate'))).toBe(false);
  });

  it('ACKNOWLEDGED overflow includes escalate option', () => {
    const actions = hrTriageMessage({ ...BASE, state: 'ACKNOWLEDGED' }).attachments[0].blocks.find(b => b.type === 'actions');
    const overflow = actions.elements.find(e => e.type === 'overflow');
    expect(overflow.options.some(o => o.value.includes('escalate'))).toBe(true);
  });
});

// ── HR → Manager follow-up ────────────────────────────────────────────────────

describe('HR follow-up → manager reply loop', () => {
  it('hrReplyModal: caseId in metadata, Send button', () => {
    const m = hrReplyModal('case_001', 'Ask Follow-up');
    expect(JSON.parse(m.private_metadata).caseId).toBe('case_001');
    expect(m.submit.text).toBe('Send');
  });

  it('managerFollowupMessage renders for all risk levels without throwing', () => {
    ['good', 'warn', 'risk'].forEach(level => {
      expect(() => managerFollowupMessage({
        caseId: 'c1', scenario: 'Policy Violation',
        hrMessage: 'Please confirm docs exist.', hrSlackId: 'U_HR', level,
      })).not.toThrow();
    });
  });

  it('managerFollowupMessage includes HR message text in blocks', () => {
    const msg = managerFollowupMessage({
      caseId: 'c1', scenario: 'Policy Violation',
      hrMessage: 'Can you confirm the PIP was signed?', hrSlackId: 'U_HR', level: 'warn',
    });
    expect(JSON.stringify(msg.attachments[0].blocks)).toContain('Can you confirm the PIP was signed?');
  });

  it('managerReplyModal carries caseId', () => {
    expect(JSON.parse(managerReplyModal('case_001', 'Policy Violation').private_metadata).caseId).toBe('case_001');
  });
});

// ── Resolve / Close flow ──────────────────────────────────────────────────────

describe('Resolve / Close flow', () => {
  it('hrResolveModal: correct callback_id, caseId in metadata, text input', () => {
    const m = hrResolveModal('case_999');
    expect(m.callback_id).toBe('pac_modal_hr_resolve');
    expect(JSON.parse(m.private_metadata).caseId).toBe('case_999');
    expect(m.blocks.find(b => b.type === 'input').element.type).toBe('plain_text_input');
  });
});

// ── Upload Documentation modal ────────────────────────────────────────────────

describe('Upload Documentation modal (pac_blocks shape)', () => {
  it('resultDmMessage Upload Documentation button present pre-notify (with refName)', () => {
    const msg = resultDmMessage({ scenario: 'Policy Violation', level: 'warn', caseId: 'c1', hrNotified: false, refName: 'EE-001' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    const btn = actions.elements.find(e => e.action_id === 'pac_result_upload_doc');
    expect(btn).toBeDefined();
    expect(btn.value).toBe('c1');
    expect(btn.text.text).toContain('Attach Files');
  });

  it('resultDmMessage Upload Documentation button present post-notify (with refName)', () => {
    const msg = resultDmMessage({ scenario: 'Policy Violation', level: 'risk', caseId: 'c1', hrNotified: true, refName: 'EE-001' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    const btn = actions.elements.find(e => e.action_id === 'pac_result_upload_doc');
    expect(btn).toBeDefined();
    expect(btn.value).toBe('c1');
  });

  it('Upload Documentation button value is caseId for all risk levels (with refName)', () => {
    ['good', 'warn', 'risk'].forEach(level => {
      const msg = resultDmMessage({ scenario: 'Policy Violation', level, caseId: 'case_upload_test', hrNotified: false, refName: 'EE-001' });
      const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
      const btn = actions.elements.find(e => e.action_id === 'pac_result_upload_doc');
      expect(btn.value).toBe('case_upload_test');
    });
  });

  it('self-check: no Upload Documentation button (no refName)', () => {
    const msg = resultDmMessage({ scenario: 'Policy Violation', level: 'warn', caseId: 'c1' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    expect(actions.elements.find(e => e.action_id === 'pac_result_upload_doc')).toBeUndefined();
  });
});

// ── Error / edge cases ────────────────────────────────────────────────────────

describe('Edge cases and error resistance', () => {
  it('resultDmMessage handles minimal required fields', () => {
    expect(() => resultDmMessage({ scenario: 'Policy Violation', level: 'good', caseId: 'c1' })).not.toThrow();
  });

  it('questionsModal handles empty questions array', () => {
    const meta = JSON.stringify({ caseId: 'c1', scenario: 'Unknown', refName: '', managerId: 'U1' });
    expect(() => questionsModal('Unknown', [], meta)).not.toThrow();
  });

  it('hrTriageMessage handles missing optional fields', () => {
    expect(() => hrTriageMessage({
      scenario: 'Policy Violation', level: 'warn',
      caseId: 'c1', managerSlackId: 'U1',
      submittedAt: new Date().toISOString(),
    })).not.toThrow();
  });

  it('computeScore handles empty answers array', () => {
    const qs = [{ q: 'Q', hint: '', weight: 1, critical: false }];
    expect(() => computeScore(qs, [])).not.toThrow();
  });
});
