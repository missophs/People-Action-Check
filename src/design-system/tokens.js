// PAC Design Tokens — single source of truth for all color, type, spacing, and layout values.
// This JS mirror of tokens.css is used by Slack Block Kit and any non-CSS surface.
// When updating values here, sync tokens.css.

export const COLOR = {
  // ── Base surface
  bg:               '#020617',
  bgAlt:            '#050d1f',
  bgGradient:       'linear-gradient(160deg,#020617 0%,#050d1f 50%,#020617 100%)',

  // ── Surface layers (alpha over base)
  surface0:         'rgba(255,255,255,0.025)',
  surface1:         'rgba(255,255,255,0.04)',
  surface2:         'rgba(255,255,255,0.03)',

  // ── Borders
  border0:          'rgba(255,255,255,0.05)',
  border1:          'rgba(255,255,255,0.07)',
  border2:          'rgba(255,255,255,0.08)',
  border3:          'rgba(255,255,255,0.10)',

  // ── Text
  text:             '#f8fafc',
  text70:           'rgba(248,250,252,0.95)',
  text65:           'rgba(248,250,252,0.90)',
  text60:           'rgba(248,250,252,0.85)',
  textMuted:        '#dbe4ed',
  textDim:          '#bccbda',

  // ── Accent (primary interactive — cyan)
  accent:           '#22c1ff',
  accentBg:         'rgba(34,193,255,0.12)',
  accentBorder:     'rgba(34,193,255,0.45)',
  accentBorderAlt:  'rgba(34,193,255,0.30)',
  accentBorder2:    'rgba(34,193,255,0.20)',
  accentBorder3:    'rgba(34,193,255,0.25)',
  accentBorder4:    'rgba(34,193,255,0.18)',
  accentSurface:    'rgba(34,193,255,0.07)',
  accentSurfaceAlt: 'rgba(34,193,255,0.05)',
  accentSurface2:   'rgba(34,193,255,0.06)',
  accentTabBg:      'rgba(34,193,255,0.15)',
  accentText55:     'rgba(34,193,255,0.85)',
  accentText65:     'rgba(34,193,255,0.90)',
  accentText70:     'rgba(34,193,255,0.92)',
  accentText75:     'rgba(34,193,255,0.95)',
  accentText85:     'rgba(34,193,255,1)',

  // ── Accent gradients
  accentGradient:       'linear-gradient(90deg,#22c1ff,#6ee7b7)',
  accentCardGradient:   'linear-gradient(135deg,rgba(34,193,255,0.12),rgba(110,231,183,0.07))',
  accentPanelGradient:  'linear-gradient(135deg,rgba(34,193,255,0.07),rgba(110,231,183,0.05))',

  // ── Risk: Low (good / green)
  good:             '#34d399',
  goodBg:           'rgba(52,211,153,0.10)',
  goodBgLight:      'rgba(52,211,153,0.08)',
  goodBgAlt:        'rgba(52,211,153,0.06)',
  goodBgStrong:     'rgba(52,211,153,0.20)',
  goodBorder:       'rgba(52,211,153,0.30)',
  goodBorderStrong: 'rgba(52,211,153,0.55)',
  goodBorderAlt:    'rgba(52,211,153,0.25)',
  goodBorderDeep:   'rgba(52,211,153,0.28)',
  goodLight:        '#a7f3d0',
  goodText70:       'rgba(110,231,183,0.90)',

  // ── Risk: Elevated (warn / yellow)
  warn:             '#fbbf24',
  warnBg:           'rgba(251,191,36,0.10)',
  warnBgLight:      'rgba(251,191,36,0.08)',
  warnBgAlt:        'rgba(251,191,36,0.06)',
  warnBgStrong:     'rgba(251,191,36,0.15)',
  warnSurface:      'rgba(251,191,36,0.07)',
  warnBorder:       'rgba(251,191,36,0.30)',
  warnBorderStrong: 'rgba(251,191,36,0.45)',
  warnBorderAlt:    'rgba(251,191,36,0.25)',
  warnBorderDeep:   'rgba(251,191,36,0.22)',
  warnLight:        '#fde68a',
  warnText90:       'rgba(251,191,36,0.90)',
  warnText85:       'rgba(253,230,138,0.85)',

  // ── Risk: High (risk / red)
  risk:             '#fb7185',
  riskBg:           'rgba(251,113,133,0.10)',
  riskBgLight:      'rgba(251,113,133,0.08)',
  riskBgAlt:        'rgba(251,113,133,0.06)',
  riskBgStrong:     'rgba(251,113,133,0.20)',
  riskBorder:       'rgba(251,113,133,0.30)',
  riskBorderStrong: 'rgba(251,113,133,0.55)',
  riskBorderAlt:    'rgba(251,113,133,0.25)',
  riskBorderDeep:   'rgba(251,113,133,0.28)',
  riskBorderMed:    'rgba(251,113,133,0.35)',
  riskLight:        '#fecdd3',
  riskText90:       'rgba(253,205,211,0.90)',

  // ── Overlay
  overlay:          'rgba(2,6,23,0.88)',
};

export const FONT = {
  family: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",

  // Rem size scale
  size: {
    xxs:  '0.62rem',
    xs:   '0.68rem',
    sm:   '0.72rem',
    md:   '0.82rem',
    base: '0.88rem',
    lg:   '1rem',
    xl:   '1.1rem',
    '2xl':'1.2rem',
    '3xl':'1.25rem',
  },

  // Line heights
  leading: {
    tight:   1.4,
    base:    1.5,
    relaxed: 1.55,
    loose:   1.6,
    wide:    1.8,
  },

  // Letter spacing
  tracking: {
    label: '0.08em',
    caps:  '0.07em',
    sm:    '0.05em',
    xs:    '0.04em',
  },
};

// Pixel spacing scale — use SPACE.px(n) for CSS strings
export const SPACE = {
  1:  4,
  2:  8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  px: (n) => `${n}px`,
};

export const RADIUS = {
  badge:  4,
  tag:    5,
  xs:     7,
  sm:     8,
  md:     9,
  lg:    10,
  xl:    11,
  '2xl': 12,
  '3xl': 14,
  card:  16,
  full:  999,
};

export const BREAKPOINT = {
  // Named breakpoints (px)
  mobile:  600,
  tablet:  768,
  desktop: 1024,
  wide:    1280,

  // CSS media query helpers
  max: (bp) => `(max-width: ${bp}px)`,
  min: (bp) => `(min-width: ${bp}px)`,
};

export const SHADOW = {
  card:   '0 2px 12px rgba(0,0,0,0.35)',
  raised: '0 4px 20px rgba(0,0,0,0.50)',
  accent: '0 0 16px rgba(34,193,255,0.12)',
};

export const TRANSITION = {
  fast:   'all 0.20s',
  base:   'all 0.25s',
  slow:   'all 0.30s',
  width:  'width 0.30s',
  widthSlow: 'width 0.40s',
};

// ── Slack Block Kit surface limits (for Slack equivalents)
// These are advisory constraints for components that will map to Block Kit.
export const SLACK = {
  maxTextLength:    3000, // mrkdwn field text limit
  maxSectionFields: 10,   // section block fields per block
  maxBlocks:        50,   // blocks per message
  maxActionItems:   25,   // actions block elements
  maxModalBlocks:   100,  // modal view blocks
};
