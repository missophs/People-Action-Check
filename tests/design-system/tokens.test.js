import { describe, it, expect } from 'vitest';
import { COLOR, FONT, SPACE, RADIUS, BREAKPOINT, SHADOW, TRANSITION, SLACK } from '../../src/design-system/tokens.js';

describe('Design tokens — COLOR', () => {
  it('base background is the correct dark navy', () => {
    expect(COLOR.bg).toBe('#020617');
  });

  it('primary accent is the correct cyan', () => {
    expect(COLOR.accent).toBe('#22c1ff');
  });

  it('risk colors are distinct from each other', () => {
    expect(COLOR.good).not.toBe(COLOR.warn);
    expect(COLOR.warn).not.toBe(COLOR.risk);
    expect(COLOR.good).not.toBe(COLOR.risk);
  });

  it('Low Risk color (good) is green', () => {
    expect(COLOR.good).toBe('#34d399');
  });

  it('Elevated Risk color (warn) is yellow', () => {
    expect(COLOR.warn).toBe('#fbbf24');
  });

  it('High Risk color (risk) is red/pink', () => {
    expect(COLOR.risk).toBe('#fb7185');
  });

  it('every color key has a non-empty string value', () => {
    for (const [key, val] of Object.entries(COLOR)) {
      expect(typeof val, `COLOR.${key}`).toBe('string');
      expect(val.length, `COLOR.${key} is empty`).toBeGreaterThan(0);
    }
  });

  it('hex colors start with #', () => {
    const hexKeys = ['bg', 'bgAlt', 'text', 'textMuted', 'textDim', 'accent',
      'good', 'goodLight', 'warn', 'warnLight', 'risk', 'riskLight'];
    for (const key of hexKeys) {
      expect(COLOR[key], `COLOR.${key}`).toMatch(/^#[0-9a-fA-F]{3,6}$/);
    }
  });

  it('alpha values use rgba()', () => {
    const alphaKeys = ['surface0', 'surface1', 'border1', 'goodBg', 'warnBg', 'riskBg'];
    for (const key of alphaKeys) {
      expect(COLOR[key], `COLOR.${key}`).toMatch(/^rgba\(/);
    }
  });
});

describe('Design tokens — FONT', () => {
  it('font family is defined', () => {
    expect(FONT.family).toContain('sans-serif');
  });

  it('size scale has all required keys', () => {
    const required = ['xxs', 'xs', 'sm', 'md', 'base', 'lg', 'xl', '2xl', '3xl'];
    for (const key of required) {
      expect(FONT.size[key], `FONT.size.${key}`).toBeDefined();
    }
  });

  it('size values are rem strings', () => {
    for (const [key, val] of Object.entries(FONT.size)) {
      expect(val, `FONT.size.${key}`).toMatch(/^\d+(\.\d+)?rem$/);
    }
  });

  it('leading values are numbers', () => {
    for (const [key, val] of Object.entries(FONT.leading)) {
      expect(typeof val, `FONT.leading.${key}`).toBe('number');
    }
  });
});

describe('Design tokens — SPACE', () => {
  it('px helper returns a pixel string', () => {
    expect(SPACE.px(8)).toBe('8px');
    expect(SPACE.px(16)).toBe('16px');
  });

  it('numeric keys are in ascending order', () => {
    const values = [SPACE[1], SPACE[2], SPACE[3], SPACE[4], SPACE[5], SPACE[6], SPACE[7]];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});

describe('Design tokens — RADIUS', () => {
  it('full radius is a pill (999)', () => {
    expect(RADIUS.full).toBe(999);
  });

  it('card radius is 16', () => {
    expect(RADIUS.card).toBe(16);
  });

  it('badge radius is the smallest', () => {
    const values = Object.entries(RADIUS)
      .filter(([k]) => k !== 'full')
      .map(([, v]) => v);
    expect(RADIUS.badge).toBe(Math.min(...values));
  });
});

describe('Design tokens — BREAKPOINT', () => {
  it('mobile breakpoint is 600px', () => {
    expect(BREAKPOINT.mobile).toBe(600);
  });

  it('breakpoints are in ascending order', () => {
    expect(BREAKPOINT.mobile).toBeLessThan(BREAKPOINT.tablet);
    expect(BREAKPOINT.tablet).toBeLessThan(BREAKPOINT.desktop);
    expect(BREAKPOINT.desktop).toBeLessThan(BREAKPOINT.wide);
  });

  it('max() helper returns a media query string', () => {
    expect(BREAKPOINT.max(600)).toBe('(max-width: 600px)');
  });

  it('min() helper returns a media query string', () => {
    expect(BREAKPOINT.min(1024)).toBe('(min-width: 1024px)');
  });
});

describe('Design tokens — SLACK', () => {
  it('text length limit is defined', () => {
    expect(typeof SLACK.maxTextLength).toBe('number');
    expect(SLACK.maxTextLength).toBeGreaterThan(0);
  });

  it('block limit is defined', () => {
    expect(typeof SLACK.maxBlocks).toBe('number');
  });
});
