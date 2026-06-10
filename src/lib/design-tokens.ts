export function readCssToken(tokenName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  return value || fallback;
}

export const AW_REFERENCE_TOKENS = {
  color: {
    stage: '#505050',
    card: '#000000',
    cardRaised: '#050505',
    cardMuted: 'rgb(255 255 255 / 0.055)',
    text: '#FFFFFF',
    textMuted: 'rgb(255 255 255 / 0.66)',
    textDim: 'rgb(255 255 255 / 0.42)',
    neon: '#00F09C',
    amber: '#FFB000',
    purple: '#8F42FF',
    blue: '#5B7CFF',
    danger: '#FF5C7A',
    border: 'rgb(255 255 255 / 0.13)',
    borderStrong: 'rgb(255 255 255 / 0.22)',
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
    card: '0 46px 84px rgb(0 0 0 / 0.46), 0 10px 22px rgb(0 0 0 / 0.36)',
    glow: '0 0 40px rgb(0 240 156 / 0.24)',
  },
} as const;

export const AW_CHART_TOKENS = {
  surface: AW_REFERENCE_TOKENS.color.card,
  surfaceMuted: AW_REFERENCE_TOKENS.color.cardMuted,
  border: AW_REFERENCE_TOKENS.color.border,
  borderSubtle: 'rgb(255 255 255 / 0.08)',
  text: AW_REFERENCE_TOKENS.color.text,
  textMuted: AW_REFERENCE_TOKENS.color.textMuted,
  accent: AW_REFERENCE_TOKENS.color.neon,
  accentMuted: AW_REFERENCE_TOKENS.color.textMuted,
  accentLine: AW_REFERENCE_TOKENS.color.neon,
  success: AW_REFERENCE_TOKENS.color.neon,
  warning: AW_REFERENCE_TOKENS.color.amber,
  danger: AW_REFERENCE_TOKENS.color.danger,
  info: AW_REFERENCE_TOKENS.color.blue,
  palette: [
    AW_REFERENCE_TOKENS.color.neon,
    AW_REFERENCE_TOKENS.color.amber,
    AW_REFERENCE_TOKENS.color.purple,
    AW_REFERENCE_TOKENS.color.blue,
  ],
} as const;

export function getAwChartPalette(): string[] {
  return [
    readCssToken('--aw-neon-green', AW_REFERENCE_TOKENS.color.neon),
    readCssToken('--aw-neon-amber', AW_REFERENCE_TOKENS.color.amber),
    readCssToken('--aw-neon-purple', AW_REFERENCE_TOKENS.color.purple),
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
