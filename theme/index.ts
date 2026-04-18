import {Platform, useColorScheme} from 'react-native';

// Signal Light — premium hardware companion palette
// Matches the CommuteLive website: light gray base, dark text, vivid orange accent
const signal = {
  // Backgrounds — Apple's grouped table view pattern
  base: '#F2F2F7',         // page background — matches website body background
  surface: '#FFFFFF',      // cards, panels, sheets
  elevated: '#FFFFFF',     // modals
  border: 'rgba(0,0,0,0.09)',

  // Vivid orange accent — matches website #FF8000
  accentSoft: '#FFB340',
  accent: '#FF8000',
  accentStrong: '#E56E00',
  accentDeep: '#C45C00',

  // Text hierarchy — matches website foreground #1c1a17
  text: '#1c1a17',
  textSecondary: 'rgba(28,26,23,0.55)',
  textTertiary: 'rgba(28,26,23,0.42)',
  textDisabled: 'rgba(28,26,23,0.18)',

  // Semantic
  success: '#1A7F3C',
  successSurface: 'rgba(26,127,60,0.08)',
  warningSurface: 'rgba(245,163,32,0.10)',
  dangerSurface: 'rgba(209,50,40,0.07)',
  infoSurface: 'rgba(0,113,227,0.07)',
} as const;

export const colors = {
  background: signal.base,
  surface: signal.surface,
  surfaceMuted: '#F9F9FB',
  card: '#F2F2F7',
  accentSurface: 'rgba(245,163,32,0.10)',
  accent: signal.accent,
  accentMuted: 'rgba(245,163,32,0.12)',
  accentStrong: signal.accentStrong,
  accentDeep: signal.accentDeep,
  onAccent: '#FFFFFF',
  text: signal.text,
  textSecondary: signal.textSecondary,
  textTertiary: signal.textTertiary,
  textMuted: signal.textSecondary,
  textDisabled: signal.textDisabled,
  border: signal.border,
  success: signal.success,
  warning: signal.accentStrong,
  warningSurface: signal.warningSurface,
  overlay: 'rgba(0,0,0,0.18)',
  overlayStrong: 'rgba(0,0,0,0.40)',
  shadow: '#000000',
  glassSurface: 'rgba(255,255,255,0.80)',
  glassSurfaceStrong: 'rgba(255,255,255,0.95)',
  selectionSurface: 'rgba(245,163,32,0.09)',
  successSurface: signal.successSurface,
  successSurfaceStrong: 'rgba(26,127,60,0.13)',
  successSurfacePreview: 'rgba(26,127,60,0.08)',
  successBorder: 'rgba(26,127,60,0.20)',
  successText: '#1A7F3C',
  successTextSoft: '#2E9952',
  dangerSurface: signal.dangerSurface,
  dangerSurfaceMuted: 'rgba(209,50,40,0.05)',
  dangerBorder: 'rgba(209,50,40,0.18)',
  dangerBorderMuted: 'rgba(209,50,40,0.12)',
  dangerText: '#C0392B',
  dangerTextSoft: '#D1322A',
  info: '#0071E3',
  // LED display preview — deep warm black, like the physical device
  previewSurface: '#110E09',
  previewSurfaceMuted: '#1A1610',
  previewSurfaceActive: '#251D13',
  previewBorder: '#2D2418',
  previewBorderMuted: '#3B2E1C',
  previewBadgeBorder: '#4C3D26',
  previewText: '#F2F2F7',
  previewTextMuted: 'rgba(242,242,247,0.55)',
  routeFallback: signal.accentStrong,
  routeFallbackText: '#FFFFFF',
  highlight: signal.accentSoft,
  editorStepComplete: signal.success,
  selectionSurfaceStrong: 'rgba(245,163,32,0.16)',
  editorPanelBorder: 'rgba(0,0,0,0.07)',
  editorPanelBorderStrong: 'rgba(0,0,0,0.12)',
  editorPanelBorderSoft: 'rgba(0,0,0,0.05)',
  editorPanelBorderInteractive: 'rgba(0,0,0,0.09)',
  editorPanelSurface: 'rgba(255,255,255,0.92)',
  editorPanelSurfaceMuted: 'rgba(249,249,251,0.88)',
  editorPanelSurfaceStrong: 'rgba(255,255,255,0.96)',
  editorPanelSurfaceActive: 'rgba(255,255,255,0.98)',
  editorPanelSurfaceCard: 'rgba(255,255,255,0.96)',
  editorAccentGhost: 'rgba(245,163,32,0.10)',
  editorProgressTrack: 'rgba(0,0,0,0.08)',
  editorProgressFill: 'rgba(245,163,32,0.55)',
  editorProgressDotSurface: '#E5E5EA',
  editorProgressDotActiveSurface: '#D8D8DD',
  editorProgressDotCompleteSurface: signal.accentStrong,
  editorTextStrong: signal.text,
  editorTextStrongAlt: '#FFFFFF',
  editorTextSoft: signal.textSecondary,
  editorTextSoftAlt: 'rgba(28,26,23,0.45)',
  editorTextMutedSoft: signal.textTertiary,
  editorTextMutedStrong: 'rgba(28,26,23,0.42)',
  editorFormatCardBorder: 'rgba(0,0,0,0.08)',
  editorFormatCardSurface: '#F9F9FB',
  editorFormatSkeleton: '#E5E5EA',
  editorFormatDivider: 'rgba(0,0,0,0.07)',
  editorMockSurface: '#080808',
  editorMockBorder: 'rgba(0,0,0,0.14)',
  editorMockBorderActive: 'rgba(245,163,32,0.50)',
  controlSurface: '#EBEBED',
  controlTrack: 'rgba(0,0,0,0.10)',
  displayShellSurface: '#1A1A1A',
  displaySlotSurface: 'rgba(255,255,255,0.04)',
  displaySlotActiveSurface: '#252118',
  displayTitle: '#F2F2F7',
  displayPlaceholder: 'rgba(242,242,247,0.35)',
  displaySubtleText: 'rgba(242,242,247,0.20)',
  displayTimeText: 'rgba(242,242,247,0.80)',
};

export const darkColors: Record<keyof typeof colors, string> = {
  background: '#1C1C1E',
  surface: '#2C2C2E',
  surfaceMuted: '#242426',
  card: '#2C2C2E',
  accentSurface: 'rgba(245,163,32,0.14)',
  accent: '#FF8000',
  accentMuted: 'rgba(245,163,32,0.15)',
  accentStrong: '#FF9500',
  accentDeep: '#E56E00',
  onAccent: '#FFFFFF',
  text: '#F2F2F7',
  textSecondary: 'rgba(242,242,247,0.60)',
  textTertiary: 'rgba(242,242,247,0.45)',
  textMuted: 'rgba(242,242,247,0.45)',
  textDisabled: 'rgba(242,242,247,0.18)',
  border: 'rgba(255,255,255,0.10)',
  success: '#30D158',
  warning: '#FF9F0A',
  warningSurface: 'rgba(255,159,10,0.12)',
  overlay: 'rgba(0,0,0,0.40)',
  overlayStrong: 'rgba(0,0,0,0.65)',
  shadow: '#000000',
  glassSurface: 'rgba(44,44,46,0.80)',
  glassSurfaceStrong: 'rgba(44,44,46,0.95)',
  selectionSurface: 'rgba(245,163,32,0.12)',
  successSurface: 'rgba(48,209,88,0.12)',
  successSurfaceStrong: 'rgba(48,209,88,0.18)',
  successSurfacePreview: 'rgba(48,209,88,0.10)',
  successBorder: 'rgba(48,209,88,0.25)',
  successText: '#30D158',
  successTextSoft: '#34C759',
  dangerSurface: 'rgba(255,69,58,0.10)',
  dangerSurfaceMuted: 'rgba(255,69,58,0.06)',
  dangerBorder: 'rgba(255,69,58,0.22)',
  dangerBorderMuted: 'rgba(255,69,58,0.14)',
  dangerText: '#FF453A',
  dangerTextSoft: '#FF6961',
  info: '#0A84FF',
  previewSurface: '#110E09',
  previewSurfaceMuted: '#1A1610',
  previewSurfaceActive: '#251D13',
  previewBorder: '#2D2418',
  previewBorderMuted: '#3B2E1C',
  previewBadgeBorder: '#4C3D26',
  previewText: '#F2F2F7',
  previewTextMuted: 'rgba(242,242,247,0.55)',
  routeFallback: '#FF9500',
  routeFallbackText: '#FFFFFF',
  highlight: '#FFB340',
  editorStepComplete: '#30D158',
  selectionSurfaceStrong: 'rgba(245,163,32,0.20)',
  editorPanelBorder: 'rgba(255,255,255,0.08)',
  editorPanelBorderStrong: 'rgba(255,255,255,0.13)',
  editorPanelBorderSoft: 'rgba(255,255,255,0.06)',
  editorPanelBorderInteractive: 'rgba(255,255,255,0.10)',
  editorPanelSurface: 'rgba(44,44,46,0.92)',
  editorPanelSurfaceMuted: 'rgba(36,36,38,0.88)',
  editorPanelSurfaceStrong: 'rgba(44,44,46,0.96)',
  editorPanelSurfaceActive: 'rgba(58,58,60,0.98)',
  editorPanelSurfaceCard: 'rgba(44,44,46,0.96)',
  editorAccentGhost: 'rgba(245,163,32,0.12)',
  editorProgressTrack: 'rgba(255,255,255,0.10)',
  editorProgressFill: 'rgba(245,163,32,0.55)',
  editorProgressDotSurface: '#3A3A3C',
  editorProgressDotActiveSurface: '#48484A',
  editorProgressDotCompleteSurface: '#FF9500',
  editorTextStrong: '#F2F2F7',
  editorTextStrongAlt: '#FFFFFF',
  editorTextSoft: 'rgba(242,242,247,0.60)',
  editorTextSoftAlt: 'rgba(242,242,247,0.45)',
  editorTextMutedSoft: 'rgba(242,242,247,0.45)',
  editorTextMutedStrong: 'rgba(242,242,247,0.42)',
  editorFormatCardBorder: 'rgba(255,255,255,0.09)',
  editorFormatCardSurface: '#2C2C2E',
  editorFormatSkeleton: '#3A3A3C',
  editorFormatDivider: 'rgba(255,255,255,0.08)',
  editorMockSurface: '#080808',
  editorMockBorder: 'rgba(255,255,255,0.12)',
  editorMockBorderActive: 'rgba(245,163,32,0.50)',
  controlSurface: '#3A3A3C',
  controlTrack: 'rgba(255,255,255,0.12)',
  displayShellSurface: '#1A1A1A',
  displaySlotSurface: 'rgba(255,255,255,0.04)',
  displaySlotActiveSurface: '#252118',
  displayTitle: '#F2F2F7',
  displayPlaceholder: 'rgba(242,242,247,0.35)',
  displaySubtleText: 'rgba(242,242,247,0.20)',
  displayTimeText: 'rgba(242,242,247,0.80)',
};

export function useThemeColors(): typeof colors {
  const scheme = useColorScheme();
  return (scheme === 'dark' ? darkColors : colors) as typeof colors;
}

export const settingsSectionColors = {
  account: {bg: 'rgba(0,0,0,0.05)', fg: signal.textSecondary},
  device: {bg: 'rgba(0,0,0,0.05)', fg: signal.textSecondary},
  timeFormat: {bg: 'rgba(0,0,0,0.05)', fg: signal.textSecondary},
  notifications: {bg: 'rgba(0,0,0,0.05)', fg: signal.textSecondary},
  privacy: {bg: 'rgba(0,0,0,0.05)', fg: signal.textSecondary},
  session: {bg: 'rgba(209,50,40,0.08)', fg: '#C0392B'},
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
};

export const typography = {
  caption: 12,
  label: 13,
  body: 14,
  bodyLg: 16,
  title: 16,
  titleLg: 20,
  pageTitle: 32,
};

export const layout = {
  screenPadding: spacing.lg,
  screenGap: spacing.lg,
  sectionGap: spacing.md,
  cardPadding: spacing.md,
  cardPaddingLg: spacing.lg,
  buttonHeight: 48,
  buttonHeightLg: 52,
  inputHeight: 48,
  headerHeight: 56,
  tabHeight: 56,
  iconButton: 36,
  chromeSize: 32,
  logoSize: 26,
  bottomInset: 120,
};

const webAvenirStack = '"Avenir Next", Avenir, system-ui, sans-serif';
const androidFallback = 'sans-serif';

const platformFont = (iosFamily: string) =>
  Platform.select({
    ios: iosFamily,
    android: androidFallback,
    default: webAvenirStack,
  }) ?? webAvenirStack;

export const fonts = {
  light: platformFont('AvenirNext-UltraLight'),
  lightItalic: platformFont('AvenirNext-UltraLightItalic'),
  sans: platformFont('AvenirNext-Regular'),
  sansItalic: platformFont('AvenirNext-Italic'),
  medium: platformFont('AvenirNext-Medium'),
  mediumItalic: platformFont('AvenirNext-MediumItalic'),
  semiBold: platformFont('AvenirNext-DemiBold'),
  semiBoldItalic: platformFont('AvenirNext-DemiBoldItalic'),
  bold: platformFont('AvenirNext-Bold'),
  boldItalic: platformFont('AvenirNext-BoldItalic'),
  extraBold: platformFont('AvenirNext-Heavy'),
  extraBoldItalic: platformFont('AvenirNext-HeavyItalic'),
  black: platformFont('AvenirNext-Heavy'),
  blackItalic: platformFont('AvenirNext-HeavyItalic'),
};

export const resolveFontFamily = ({
  fontStyle,
  fontWeight,
}: {
  fontStyle?: unknown;
  fontWeight?: unknown;
}) => {
  const italic = fontStyle === 'italic';
  const numericWeight =
    typeof fontWeight === 'number'
      ? fontWeight
      : typeof fontWeight === 'string' && /^\d+$/.test(fontWeight)
        ? Number(fontWeight)
        : null;

  if (numericWeight !== null) {
    if (numericWeight >= 900) return italic ? fonts.blackItalic : fonts.black;
    if (numericWeight >= 800) return italic ? fonts.extraBoldItalic : fonts.extraBold;
    if (numericWeight >= 700) return italic ? fonts.boldItalic : fonts.bold;
    if (numericWeight >= 600) return italic ? fonts.semiBoldItalic : fonts.semiBold;
    if (numericWeight >= 500) return italic ? fonts.mediumItalic : fonts.medium;
    if (numericWeight <= 300) return italic ? fonts.lightItalic : fonts.light;
  }

  return italic ? fonts.sansItalic : fonts.sans;
};
