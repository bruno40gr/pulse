export const colors = {
  // Brand
  crimson: '#FF0044',
  crimsonDark: '#CC0036',
  espresso: '#1A130F',
  cream: '#FAF6F0',
  teal: '#00A8C8',
  tealDark: '#0090AA',
  yellow: '#F5A623',
  green: '#3D8B5F',
  greenDark: '#1F5C3A',

  // Neutrals
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  surface: '#FFFFFF',
  surfaceMuted: '#f6f8f8',
  background: '#fbfdfc',
  backgroundSecondary: '#F3F4F6',

  // Actions
  action: '#1A130F',

  // Semantic (text-only, no background boxes)
  error: '#DC2626',
  success: '#16A34A',
  warning: '#92400E',
}

export const semanticColors = {
  accent: { background: colors.teal, text: colors.surface, border: colors.teal },
  success: { background: colors.success, text: colors.surface, border: colors.success },
  danger: { background: colors.error, text: colors.surface, border: colors.error },
  warning: { background: colors.surfaceMuted, text: colors.warning, border: colors.warning },
  neutral: { background: colors.surface, text: colors.textSecondary, border: colors.border },
}

export const typography = {
  fontSans: 'var(--font-dm-sans), sans-serif',
  fontDisplay: 'var(--font-baloo-2), sans-serif',
  fontMono: 'monospace',

  // Size scale
  sizeXs: '11px',
  sizeSm: '12px',
  sizeBase: '14px',
  sizeMd: '15px',
  size15: '16px',
  sizeLg: '18px',
  sizeXl: '20px',
  size2xl: '24px',
  size3xl: '32px',

  // Weights
  weightNormal: 400,
  weightMedium: 500,
  weightSemibold: 600,
  weightBold: 700,

  // Roles — use these instead of ad-hoc styles
  h1: {
    fontFamily: 'var(--font-baloo-2), sans-serif',
    fontSize: '32px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  sectionTitle: {
    fontFamily: 'var(--font-baloo-2), sans-serif',
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '-0.015em',
    lineHeight: 1.2,
  },
  h2: {
    fontFamily: 'var(--font-dm-sans), sans-serif',
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  body: {
    fontFamily: 'var(--font-dm-sans), sans-serif',
    fontSize: '15px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  bodySmall: {
    fontFamily: 'var(--font-dm-sans), sans-serif',
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  label: {
    fontFamily: 'var(--font-dm-sans), sans-serif',
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.3,
  },
  helper: {
    fontFamily: 'var(--font-dm-sans), sans-serif',
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: 1.4,
  },
}

export const radius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
}

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  '2xl': '22px',
  '3xl': '28px',
  '4xl': '40px',
}

export const shadows = {
  sm: '0 1px 3px rgba(0,0,0,0.08)',
  md: '0 4px 12px rgba(0,0,0,0.10)',
  lg: '0 8px 24px rgba(0,0,0,0.12)',
  xl: '0 20px 60px rgba(0,0,0,0.15)',
  panel: '-8px 0 40px rgba(0,0,0,0.12)',
}