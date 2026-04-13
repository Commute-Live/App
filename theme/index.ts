import {Platform} from 'react-native';

// Signal Light — premium hardware companion palette
// Apple-grade light mode: clean whites, cool-neutral grays, warm amber accent
const signal = {
  // Backgrounds — Apple's grouped table view pattern
  base: '#F2F2F7',         // page background — Apple's grouped background gray
  surface: '#FFFFFF',      // cards, panels, sheets — white cards pop on gray bg
  elevated: '#FFFFFF',     // modals
  border: 'rgba(0,0,0,0.09)',

  // Vivid orange accent — bright, saturated, energetic
  accentSoft: '#FFB340',
  accent: '#FF8000',
  accentStrong: '#E56E00',
  accentDeep: '#C45C00',

  // Text hierarchy — Apple's exact light-mode values
  text: '#1D1D1F',
  textSecondary: 'rgba(29,29,31,0.55)',
  textTertiary: 'rgba(29,29,31,0.32)',
  textDisabled: 'rgba(29,29,31,0.18)',

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
  card: '#F2F2F7',          // nested elements inside white cards — gray so they're visible
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
  // Glow is now a cooler amber-gold (#D4870A) rather than orange
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
  editorTextSoftAlt: 'rgba(29,29,31,0.45)',
  editorTextMutedSoft: signal.textTertiary,
  editorTextMutedStrong: 'rgba(29,29,31,0.42)',
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

export const settingsSectionColors = {
  account: {bg: 'rgba(245,163,32,0.10)', fg: signal.accentStrong},
  device: {bg: 'rgba(26,127,60,0.09)', fg: '#1A7F3C'},
  timeFormat: {bg: 'rgba(0,113,227,0.08)', fg: '#0071E3'},
  notifications: {bg: 'rgba(245,163,32,0.09)', fg: signal.accent},
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
  pageTitle: 28,
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
