// Block Kit builder unit tests.
// pac-blocks.js is CJS; loaded via createRequire from this ESM test file.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  slashResponseBlocks,
  intakeModal,
  questionsModal,
  resultDmMessage,
  hrTriageMessage,
  homeTabView,
  hrReplyModal,
  hrResolveModal,
  managerFollowupMessage,
  managerReplyModal,
  caseListBlocks,
  computeScore,
} = require('../../netlify/functions/lib/pac-blocks.js');

// ── helpers ───────────────────────────────────────────────────────────────────

function allBlocksHaveType(blocks) {
  return blocks.every(b => typeof b.type === 'string' && b.type.length > 0);
}

const SAMPLE_QUESTIONS = [
  { q: 'Q1', hint: 'h1', weight: 2, critical: false },
  { q: 'Q2', hint: 'h2', weight: 2, critical: true  },
  { q: 'Q3', hint: 'h3', weight: 1, critical: false },
];

const META = JSON.stringify({ caseId: 'pac_test_0001', scenario: 'Policy Violation', refName: 'JD', managerId: 'U123' });

// ── computeScore (CJS reimplementation) ──────────────────────────────────────

describe('computeScore (pac-blocks CJS)', () => {
  it('returns good when all yes', () => {
    expect(computeScore(SAMPLE_QUESTIONS, ['yes', 'yes', 'yes']).level).toBe('good');
  });

  it('returns risk when critical answered no', () => {
    expect(computeScore(SAMPLE_QUESTIONS, ['yes', 'no', 'yes']).level).toBe('risk');
  });

  it('returns risk when critical answered unknown', () => {
    expect(computeScore(SAMPLE_QUESTIONS, ['yes', 'unknown', 'yes']).level).toBe('risk');
  });

  it('returns warn for non-critical partial no', () => {
    const qs = [
      { q: 'A', hint: '', weight: 1, critical: false },
      { q: 'B', hint: '', weight: 1, critical: false },
      { q: 'C', hint: '', weight: 1, critical: false },
    ];
    expect(computeScore(qs, ['yes', 'yes', 'no']).level).toBe('warn');
  });

  it('handles empty questions', () => {
    const { level, ratio } = computeScore([], []);
    expect(level).toBe('good');
    expect(ratio).toBe(0);
  });
});

// ── slashResponseBlocks ───────────────────────────────────────────────────────

describe('slashResponseBlocks', () => {
  it('returns array of blocks', () => {
    const blocks = slashResponseBlocks();
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('all blocks have type', () => {
    expect(allBlocksHaveType(slashResponseBlocks())).toBe(true);
  });

  it('includes actions block with 3 buttons', () => {
    const actions = slashResponseBlocks().find(b => b.type === 'actions');
    expect(actions).toBeDefined();
    expect(actions.elements).toHaveLength(3);
    actions.elements.forEach(el => expect(el.type).toBe('button'));
  });

  it('includes HR Cases button with pac_slash_hr_cases action_id', () => {
    const actions = slashResponseBlocks().find(b => b.type === 'actions');
    expect(actions.elements.find(e => e.action_id === 'pac_slash_hr_cases')).toBeDefined();
  });

  it('includes Export button with pac_slash_export_cases action_id', () => {
    const actions = slashResponseBlocks().find(b => b.type === 'actions');
    expect(actions.elements.find(e => e.action_id === 'pac_slash_export_cases')).toBeDefined();
  });

  it('Start New Check has action_id pac_slash_open_intake and primary style', () => {
    const blocks = slashResponseBlocks();
    const section = blocks.find(b => b.accessory?.action_id === 'pac_slash_open_intake');
    expect(section).toBeDefined();
    expect(section.accessory.style).toBe('primary');
  });
});

// ── intakeModal ───────────────────────────────────────────────────────────────

describe('intakeModal', () => {
  it('type modal, callback_id pac_modal_intake', () => {
    const m = intakeModal();
    expect(m.type).toBe('modal');
    expect(m.callback_id).toBe('pac_modal_intake');
  });

  it('submit Continue, close Cancel', () => {
    const m = intakeModal();
    expect(m.submit.text).toBe('Continue');
    expect(m.close.text).toBe('Cancel');
  });

  it('scenario block uses multi_static_select', () => {
    const m = intakeModal();
    const block = m.blocks.find(b => b.block_id === 'pac_block_scenario');
    expect(block).toBeDefined();
    expect(block.element.type).toBe('multi_static_select');
    expect(block.element.action_id).toBe('pac_intake_scenario_select');
  });

  it('multi_static_select has 10 scenario options', () => {
    const m = intakeModal();
    const block = m.blocks.find(b => b.block_id === 'pac_block_scenario');
    expect(block.element.options).toHaveLength(10);
    block.element.options.forEach(opt => {
      expect(opt.text.type).toBe('plain_text');
      expect(typeof opt.value).toBe('string');
    });
  });

  it('optional ref name input exists', () => {
    const m = intakeModal();
    const refBlock = m.blocks.find(b => b.block_id === 'pac_block_ref_name');
    expect(refBlock).toBeDefined();
    expect(refBlock.optional).toBe(true);
    expect(refBlock.element.type).toBe('plain_text_input');
  });
});

// ── questionsModal ────────────────────────────────────────────────────────────

describe('questionsModal', () => {
  it('type modal, callback_id pac_modal_questions', () => {
    const m = questionsModal('Policy Violation', SAMPLE_QUESTIONS, META);
    expect(m.type).toBe('modal');
    expect(m.callback_id).toBe('pac_modal_questions');
  });

  it('private_metadata carries caseId and scenario', () => {
    const m = questionsModal('Policy Violation', SAMPLE_QUESTIONS, META);
    const parsed = JSON.parse(m.private_metadata);
    expect(parsed.caseId).toBe('pac_test_0001');
    expect(parsed.scenario).toBe('Policy Violation');
  });

  it('one radio_buttons input per question with 3 options each', () => {
    const m = questionsModal('Policy Violation', SAMPLE_QUESTIONS, META);
    const inputs = m.blocks.filter(b => b.type === 'input');
    expect(inputs).toHaveLength(SAMPLE_QUESTIONS.length);
    inputs.forEach(inp => {
      expect(inp.element.type).toBe('radio_buttons');
      expect(inp.element.options).toHaveLength(3);
    });
  });

  it('critical question label contains ⚠️', () => {
    const m = questionsModal('Policy Violation', SAMPLE_QUESTIONS, META);
    const inputs = m.blocks.filter(b => b.type === 'input');
    const critIdx = SAMPLE_QUESTIONS.findIndex(q => q.critical);
    expect(inputs[critIdx].label.text).toContain('⚠️');
  });

  it('critical warning context block present', () => {
    const m = questionsModal('Policy Violation', SAMPLE_QUESTIONS, META);
    const ctx = m.blocks.find(b => b.type === 'context');
    expect(ctx).toBeDefined();
    expect(ctx.elements[0].text).toContain('critical question');
  });

  it('radio options have yes, no, unknown values', () => {
    const m = questionsModal('Policy Violation', SAMPLE_QUESTIONS, META);
    const input = m.blocks.find(b => b.type === 'input');
    const values = input.element.options.map(o => o.value);
    expect(values).toContain('yes');
    expect(values).toContain('no');
    expect(values).toContain('unknown');
  });

  it('submit label is See Result', () => {
    expect(questionsModal('P', SAMPLE_QUESTIONS, META).submit.text).toBe('See Result');
  });
});

// ── resultDmMessage ───────────────────────────────────────────────────────────

describe('resultDmMessage', () => {
  it('returns { text, attachments } shape', () => {
    const msg = resultDmMessage({ scenario: 'Policy Violation', level: 'good', caseId: 'c1' });
    expect(typeof msg.text).toBe('string');
    expect(Array.isArray(msg.attachments)).toBe(true);
    expect(msg.attachments).toHaveLength(1);
  });

  it('attachment color matches risk level', () => {
    expect(resultDmMessage({ scenario: 'P', level: 'good', caseId: 'c1' }).attachments[0].color).toBe('#34d399');
    expect(resultDmMessage({ scenario: 'P', level: 'warn', caseId: 'c1' }).attachments[0].color).toBe('#f59e0b');
    expect(resultDmMessage({ scenario: 'P', level: 'risk', caseId: 'c1' }).attachments[0].color).toBe('#f43f5e');
  });

  it('all attachment blocks have type', () => {
    const msg = resultDmMessage({ scenario: 'Policy Violation', level: 'warn', caseId: 'c1' });
    expect(allBlocksHaveType(msg.attachments[0].blocks)).toBe(true);
  });

  it('Notify HR and Upload Documentation present when HR not notified (employee ref provided)', () => {
    const msg = resultDmMessage({ scenario: 'P', level: 'risk', caseId: 'c1', hrNotified: false, refName: 'EE-001' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    const ids = actions.elements.map(e => e.action_id);
    expect(ids).toContain('pac_result_notify_hr');
    expect(ids).toContain('pac_result_upload_doc');
  });

  it('Notify HR is danger style for high risk', () => {
    const msg = resultDmMessage({ scenario: 'P', level: 'risk', caseId: 'c1', hrNotified: false, refName: 'EE-001' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    const btn = actions.elements.find(e => e.action_id === 'pac_result_notify_hr');
    expect(btn.style).toBe('danger');
  });

  it('Notify HR is primary style for non-high risk', () => {
    const msg = resultDmMessage({ scenario: 'P', level: 'warn', caseId: 'c1', hrNotified: false, refName: 'EE-001' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    const btn = actions.elements.find(e => e.action_id === 'pac_result_notify_hr');
    expect(btn.style).toBe('primary');
  });

  it('Upload Documentation present after HR notified, Notify HR absent', () => {
    const msg = resultDmMessage({ scenario: 'P', level: 'risk', caseId: 'c1', hrNotified: true, refName: 'EE-001' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    const ids = actions.elements.map(e => e.action_id);
    expect(ids).toContain('pac_result_upload_doc');
    expect(ids).not.toContain('pac_result_notify_hr');
  });

  it('self-check mode: no refName → no Notify HR, no Upload Doc, self-check header', () => {
    const msg = resultDmMessage({ scenario: 'P', level: 'warn', caseId: 'c1', refName: '' });
    const json = JSON.stringify(msg.attachments[0].blocks);
    expect(json).toContain('self-check');
    expect(json).not.toContain('pac_result_notify_hr');
    expect(json).not.toContain('pac_result_upload_doc');
  });

  it('self-check status field shows self-check label', () => {
    const msg = resultDmMessage({ scenario: 'P', level: 'warn', caseId: 'c1' });
    const json = JSON.stringify(msg.attachments[0].blocks);
    expect(json).toContain('self-check');
  });

  it('multiple scenarios shown in scenario field', () => {
    const msg = resultDmMessage({
      scenario: 'Performance Decline',
      scenarios: ['Performance Decline', 'Attendance Issue'],
      level: 'warn', caseId: 'c1',
    });
    const json = JSON.stringify(msg.attachments[0].blocks);
    expect(json).toContain('Performance Decline');
    expect(json).toContain('Attendance Issue');
  });

  it('text field includes scenario and risk label', () => {
    const msg = resultDmMessage({ scenario: 'Attendance Issue', level: 'good', caseId: 'c1' });
    expect(msg.text).toContain('Attendance Issue');
    expect(msg.text).toContain('Low Risk');
  });
});

// ── hrTriageMessage ───────────────────────────────────────────────────────────

describe('hrTriageMessage', () => {
  const BASE = {
    scenario: 'Termination Consideration',
    level: 'risk',
    caseId: 'pac_test_9999',
    managerSlackId: 'U456',
    submittedAt: '2026-06-28T14:36:00.000Z',
  };

  it('returns { text, attachments } shape', () => {
    const msg = hrTriageMessage(BASE);
    expect(typeof msg.text).toBe('string');
    expect(Array.isArray(msg.attachments)).toBe(true);
  });

  it('attachment color matches risk level', () => {
    expect(hrTriageMessage({ ...BASE, level: 'risk' }).attachments[0].color).toBe('#f43f5e');
    expect(hrTriageMessage({ ...BASE, level: 'warn' }).attachments[0].color).toBe('#f59e0b');
    expect(hrTriageMessage({ ...BASE, level: 'good' }).attachments[0].color).toBe('#34d399');
  });

  it('all attachment blocks have type', () => {
    expect(allBlocksHaveType(hrTriageMessage(BASE).attachments[0].blocks)).toBe(true);
  });

  it('SUBMITTED state: primary action is Acknowledge', () => {
    const msg = hrTriageMessage({ ...BASE, state: 'SUBMITTED' });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    const primary = actions.elements.find(e => e.style === 'primary');
    expect(primary).toBeDefined();
    expect(primary.text.text).toMatch(/Acknowledge/i);
  });

  it('includes overflow element with pac_hr_overflow action_id', () => {
    const actions = hrTriageMessage(BASE).attachments[0].blocks.find(b => b.type === 'actions');
    const overflow = actions.elements.find(e => e.type === 'overflow');
    expect(overflow).toBeDefined();
    expect(overflow.action_id).toBe('pac_hr_overflow');
    expect(overflow.options.length).toBeGreaterThan(0);
  });

  it('overflow option values follow pac_hr_<action>::<caseId> format', () => {
    const actions = hrTriageMessage(BASE).attachments[0].blocks.find(b => b.type === 'actions');
    const overflow = actions.elements.find(e => e.type === 'overflow');
    overflow.options.forEach(opt => {
      expect(opt.value).toMatch(/^pac_hr_.+::pac_test_9999$/);
    });
  });

  it('shows claimedBy context when provided', () => {
    const msg = hrTriageMessage({ ...BASE, state: 'UNDER_REVIEW', claimedBy: 'U789' });
    expect(JSON.stringify(msg.attachments[0].blocks)).toContain('U789');
  });
});

// ── homeTabView ───────────────────────────────────────────────────────────────

describe('homeTabView', () => {
  it('type is home', () => {
    expect(homeTabView().type).toBe('home');
  });

  it('has non-empty blocks array, all with type', () => {
    const view = homeTabView();
    expect(view.blocks.length).toBeGreaterThan(0);
    expect(allBlocksHaveType(view.blocks)).toBe(true);
  });

  it('Start New Check button present', () => {
    const view = homeTabView();
    const section = view.blocks.find(b => b.accessory?.action_id === 'pac_slash_open_scenario');
    expect(section).toBeDefined();
  });

  it('does NOT include Active Cases section', () => {
    expect(JSON.stringify(homeTabView().blocks)).not.toContain('Active Cases');
  });

  it('includes scenarios and how-it-works content', () => {
    const json = JSON.stringify(homeTabView().blocks);
    expect(json).toContain('Performance Decline');
    expect(json).toContain('How to Use');
  });
});

// ── HR / manager modals ───────────────────────────────────────────────────────

describe('hrReplyModal', () => {
  it('callback_id pac_modal_hr_reply, caseId in metadata', () => {
    const m = hrReplyModal('c1');
    expect(m.callback_id).toBe('pac_modal_hr_reply');
    expect(JSON.parse(m.private_metadata).caseId).toBe('c1');
  });

  it('has multiline plain_text_input', () => {
    const input = hrReplyModal('c1').blocks.find(b => b.type === 'input');
    expect(input.element.type).toBe('plain_text_input');
    expect(input.element.multiline).toBe(true);
  });
});

describe('hrResolveModal', () => {
  it('callback_id pac_modal_hr_resolve, caseId in metadata', () => {
    const m = hrResolveModal('c1');
    expect(m.callback_id).toBe('pac_modal_hr_resolve');
    expect(JSON.parse(m.private_metadata).caseId).toBe('c1');
  });
});

describe('managerFollowupMessage', () => {
  it('returns { text, attachments } with correct color', () => {
    const msg = managerFollowupMessage({
      caseId: 'c1', scenario: 'P', hrMessage: 'Q?', hrSlackId: 'U', level: 'risk',
    });
    expect(typeof msg.text).toBe('string');
    expect(msg.attachments[0].color).toBe('#f43f5e');
  });

  it('includes Reply to HR button', () => {
    const msg = managerFollowupMessage({
      caseId: 'c1', scenario: 'P', hrMessage: 'Q?', hrSlackId: 'U', level: 'good',
    });
    const actions = msg.attachments[0].blocks.find(b => b.type === 'actions');
    expect(actions.elements.find(e => e.action_id === 'pac_mgr_reply')).toBeDefined();
  });
});

describe('managerReplyModal', () => {
  it('callback_id pac_modal_mgr_reply, caseId in metadata', () => {
    const m = managerReplyModal('c1', 'Policy Violation');
    expect(m.callback_id).toBe('pac_modal_mgr_reply');
    expect(JSON.parse(m.private_metadata).caseId).toBe('c1');
  });
});

describe('caseListBlocks', () => {
  const CASES = [
    { id: 'c1', scenario: 'Policy Violation', risk: 'warn', state: 'SUBMITTED', updatedAt: '2026-06-28T00:00:00Z', createdAt: '2026-06-28T00:00:00Z' },
    { id: 'c2', scenario: 'Attendance Issue',  risk: 'good', state: 'CLOSED',   updatedAt: '2026-06-27T00:00:00Z', createdAt: '2026-06-27T00:00:00Z' },
  ];

  it('returns array with all types', () => {
    const blocks = caseListBlocks(CASES);
    expect(Array.isArray(blocks)).toBe(true);
    expect(allBlocksHaveType(blocks)).toBe(true);
  });

  it('includes case IDs', () => {
    const json = JSON.stringify(caseListBlocks(CASES));
    expect(json).toContain('Policy Violation');
    expect(json).toContain('Attendance Issue');
  });

  it('handles empty list', () => {
    expect(Array.isArray(caseListBlocks([]))).toBe(true);
  });
});
