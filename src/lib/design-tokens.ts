export function readCssToken(tokenName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  return value || fallback;
}

export const AW_REFERENCE_TOKENS = {
  color: {
    stage: '#0E100F',
    card: '#111412',
    cardMuted: 'rgb(238 243 234 / 0.035)',
    text: '#EEF3EA',
    textMuted: 'rgb(230 237 226 / 0.82)',
    textDim: 'rgb(205 217 201 / 0.68)',
    mist: '#DDE8D8',
    sage: '#A9BAA5',
    line: '#A8C9A3',
    amber: '#D8B86C',
    blue: '#8DACE0',
    danger: '#D9897F',
    border: 'rgb(238 243 234 / 0.12)',
    borderStrong: 'rgb(238 243 234 / 0.18)',
  },
  fontSize: {
    caption: '11px',
    body: '13px',
    label: '16px',
    title: '24px',
    metric: '40px',
  },
  space: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '10px',
    lg: '12px',
  },
  shadow: {
    card: '0 24px 56px rgb(0 0 0 / 0.38), inset 0 1px 0 rgb(238 243 234 / 0.035)',
    glow: '0 0 0 1px rgb(238 243 234 / 0.12), 0 14px 28px rgb(0 0 0 / 0.24)',
  },
} as const;

export const AW_CHART_TOKENS = {
  surface: AW_REFERENCE_TOKENS.color.card,
  surfaceMuted: AW_REFERENCE_TOKENS.color.cardMuted,
  border: AW_REFERENCE_TOKENS.color.border,
  borderSubtle: 'rgb(238 243 234 / 0.085)',
  text: AW_REFERENCE_TOKENS.color.text,
  textMuted: AW_REFERENCE_TOKENS.color.textMuted,
  accent: AW_REFERENCE_TOKENS.color.mist,
  accentMuted: AW_REFERENCE_TOKENS.color.textMuted,
  accentLine: AW_REFERENCE_TOKENS.color.line,
  success: AW_REFERENCE_TOKENS.color.line,
  warning: AW_REFERENCE_TOKENS.color.amber,
  danger: AW_REFERENCE_TOKENS.color.danger,
  info: AW_REFERENCE_TOKENS.color.blue,
  areaNeutral: 'rgb(238 243 234 / 0.018)',
  areaNeutralDim: 'rgb(238 243 234 / 0.006)',
  areaSuccess: 'rgb(168 201 163 / 0.14)',
  areaInfo: 'rgb(159 182 217 / 0.08)',
  palette: [
    AW_REFERENCE_TOKENS.color.line,
    AW_REFERENCE_TOKENS.color.sage,
    AW_REFERENCE_TOKENS.color.blue,
    AW_REFERENCE_TOKENS.color.amber,
  ],
} as const;

export function getAwChartPalette(): string[] {
  return [
    readCssToken('--aw-neon-green', AW_REFERENCE_TOKENS.color.line),
    readCssToken('--aw-neon-purple', AW_REFERENCE_TOKENS.color.sage),
    readCssToken('--aw-neon-amber', AW_REFERENCE_TOKENS.color.amber),
    readCssToken('--aw-neon-blue', AW_REFERENCE_TOKENS.color.blue),
  ];
}

export type AwTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

export const AW_TONE_TEXT_CLASS: Record<AwTone, string> = {
  success: 'text-aw-success',
  warning: 'text-aw-warning',
  danger: 'text-aw-danger',
  info: 'text-aw-info',
  neutral: 'aw-text-tertiary',
  accent: 'text-aw-accent-mist',
};

export const AW_TONE_DOT_CLASS: Record<AwTone, string> = {
  success: 'aw-status-success',
  warning: 'aw-status-warning',
  danger: 'aw-status-danger',
  info: 'aw-status-info',
  neutral: '',
  accent: 'aw-status-success',
};

export function getAwToneTextClass(tone: AwTone): string {
  return AW_TONE_TEXT_CLASS[tone] || AW_TONE_TEXT_CLASS.neutral;
}

export function getAwToneDotClass(tone: AwTone): string {
  return AW_TONE_DOT_CLASS[tone] || AW_TONE_DOT_CLASS.neutral;
}
