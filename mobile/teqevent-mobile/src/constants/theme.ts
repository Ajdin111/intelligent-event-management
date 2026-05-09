// ─── Colors ────────────────────────────────────────────────────────────────
export const Colors = {
  // Backgrounds
  bg: 'rgb(26,31,34)',
  card: 'rgb(32,38,42)',
  cardElevated: 'rgb(38,45,50)',

  // Borders
  border: 'rgba(255,255,255,0.10)',
  borderMed: 'rgba(255,255,255,0.22)',

  // Text
  text: '#ffffff',
  textSub: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.35)',

  // Accent
  accent: '#ffffff',
  accentBg: 'rgba(255,255,255,0.08)',

  // Status
  success: '#4ade80',
  successBg: 'rgba(74,222,128,0.12)',
  error: '#f87171',
  errorBg: 'rgba(248,113,113,0.12)',
  warning: '#fbbf24',
  warningBg: 'rgba(251,191,36,0.12)',
  info: '#60a5fa',
  infoBg: 'rgba(96,165,250,0.12)',

  // Transparent
  overlay: 'rgba(0,0,0,0.6)',
  scanOverlay: 'rgba(0,0,0,0.75)',
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────
export const FontFamily = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semiBold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  xxxl: 36,
} as const;

export const LineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

// ─── Spacing ────────────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ─── Border Radius ──────────────────────────────────────────────────────────
export const Radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 999,
} as const;

// ─── Layout ─────────────────────────────────────────────────────────────────
export const Layout = {
  screenPadding: 16,
  cardPadding: 16,
  bottomTabHeight: 72,
  bottomTabScanSize: 56,
} as const;
