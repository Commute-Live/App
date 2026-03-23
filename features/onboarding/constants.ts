import {colors} from '../../theme';

export const onboardingPalette = {
  base: colors.background,
  surface: 'rgba(11, 11, 15, 0.72)',
  surfaceStrong: 'rgba(15, 17, 21, 0.92)',
  border: 'rgba(92, 225, 230, 0.16)',
  borderStrong: 'rgba(92, 225, 230, 0.28)',
  text: colors.text,
  textMuted: colors.textMuted,
  accent: colors.accent,
  accentSoft: 'rgba(43, 110, 120, 0.34)',
  accentSurface: 'rgba(92, 225, 230, 0.12)',
  success: colors.success,
  error: '#FB7185',
  warning: colors.warning,
  shadow: 'rgba(0, 0, 0, 0.28)',
  onAccent: colors.background,
  glowPrimary: 'rgba(92, 225, 230, 0.22)',
  glowSecondary: 'rgba(43, 110, 120, 0.26)',
  glowTertiary: 'rgba(18, 42, 56, 0.3)',
};

export const ONBOARDING_SPRING = {
  damping: 18,
  stiffness: 220,
  mass: 0.9,
};

export const ONBOARDING_STAGGER_MS = 60;

export const ONBOARDING_MAX_WIDTH = 560;
