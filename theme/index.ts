import {Platform} from 'react-native';

const goldenHour = {
  base: '#F7F2EB',
  surface: '#EDE4D4',
  elevated: '#E0D8CC',
  border: '#D4CABC',
  accentSoft: '#E8784A',
  accent: '#C4651A',
  accentStrong: '#A0521A',
  accentDeep: '#7A3C10',
  text: '#1C1A17',
  textSecondary: '#4A3728',
  textTertiary: '#8C7060',
  textDisabled: '#C4B4A4',
  successSurface: '#E8F2E8',
  warningSurface: '#FBF0E4',
  dangerSurface: '#F5E8E8',
  infoSurface: '#EEF0F8',
} as const;

export const colors = {
  background: goldenHour.base,
  surface: goldenHour.surface,
  surfaceMuted: goldenHour.surface,
  card: goldenHour.elevated,
  accentSurface: '#F3DDC9',
  accent: goldenHour.accent,
  accentMuted: '#EED8C4',
  accentStrong: goldenHour.accentStrong,
  accentDeep: goldenHour.accentDeep,
  onAccent: goldenHour.text,
  text: goldenHour.text,
  textSecondary: goldenHour.textSecondary,
  textTertiary: goldenHour.textTertiary,
  textMuted: goldenHour.textSecondary,
  textDisabled: goldenHour.textDisabled,
  border: goldenHour.border,
  success: '#6F8B69',
  warning: goldenHour.accentStrong,
  warningSurface: goldenHour.warningSurface,
  overlay: 'rgba(28, 26, 23, 0.18)',
  overlayStrong: 'rgba(28, 26, 23, 0.4)',
  shadow: '#1C1A17',
  glassSurface: 'rgba(247, 242, 235, 0.76)',
  glassSurfaceStrong: 'rgba(247, 242, 235, 0.92)',
  selectionSurface: '#F1E1D1',
  successSurface: goldenHour.successSurface,
  successSurfaceStrong: '#DAE9D6',
  successSurfacePreview: '#E8F2E8',
  successBorder: '#C8DABF',
  successText: '#567251',
  successTextSoft: '#6F8B69',
  dangerSurface: goldenHour.dangerSurface,
  dangerSurfaceMuted: '#F0DEDE',
  dangerBorder: '#DFC1C1',
  dangerBorderMuted: '#E8CFCF',
  dangerText: '#A04D45',
  dangerTextSoft: '#B85E55',
  info: '#6F6886',
  previewSurface: '#2C1F14',
  previewSurfaceMuted: '#35271C',
  previewSurfaceActive: '#4A3728',
  previewBorder: '#5A4332',
  previewBorderMuted: '#70563F',
  previewBadgeBorder: '#8C7060',
  previewText: goldenHour.base,
  previewTextMuted: '#E0D8CC',
  routeFallback: goldenHour.accentStrong,
  routeFallbackText: goldenHour.base,
  highlight: goldenHour.accentSoft,
  editorStepComplete: '#6F8B69',
  selectionSurfaceStrong: '#E4CCB7',
  editorPanelBorder: 'rgba(122, 90, 62, 0.18)',
  editorPanelBorderStrong: 'rgba(122, 90, 62, 0.28)',
  editorPanelBorderSoft: 'rgba(122, 90, 62, 0.14)',
  editorPanelBorderInteractive: 'rgba(122, 90, 62, 0.22)',
  editorPanelSurface: 'rgba(247, 242, 235, 0.92)',
  editorPanelSurfaceMuted: 'rgba(239, 230, 216, 0.88)',
  editorPanelSurfaceStrong: 'rgba(244, 236, 225, 0.96)',
  editorPanelSurfaceActive: 'rgba(237, 223, 209, 0.98)',
  editorPanelSurfaceCard: 'rgba(245, 238, 227, 0.96)',
  editorAccentGhost: 'rgba(196, 101, 26, 0.14)',
  editorProgressTrack: 'rgba(122, 90, 62, 0.18)',
  editorProgressFill: 'rgba(196, 101, 26, 0.42)',
  editorProgressDotSurface: '#F1E7DA',
  editorProgressDotActiveSurface: '#EAD9C8',
  editorProgressDotCompleteSurface: goldenHour.accentStrong,
  editorTextStrong: goldenHour.text,
  editorTextStrongAlt: goldenHour.base,
  editorTextSoft: goldenHour.textSecondary,
  editorTextSoftAlt: '#EDE4D4',
  editorTextMutedSoft: goldenHour.textTertiary,
  editorTextMutedStrong: '#6B584A',
  editorFormatCardBorder: '#DDD0C1',
  editorFormatCardSurface: '#F5EEE3',
  editorFormatSkeleton: '#E7D9CA',
  editorFormatDivider: '#DED2C7',
  editorMockSurface: '#0A0A0A',
  editorMockBorder: 'rgba(224, 216, 204, 0.3)',
  editorMockBorderActive: 'rgba(232, 120, 74, 0.5)',
  controlSurface: '#EEE3D3',
  controlTrack: '#D8CDBC',
  displayShellSurface: '#1A1A1A',
  displaySlotSurface: 'rgba(255,255,255,0.04)',
  displaySlotActiveSurface: '#4A3728',
  displayTitle: goldenHour.base,
  displayPlaceholder: goldenHour.textTertiary,
  displaySubtleText: goldenHour.textDisabled,
  displayTimeText: '#F2E9DC',
};

export const settingsSectionColors = {
  account: {bg: '#F1E1D1', fg: goldenHour.accentStrong},
  device: {bg: goldenHour.successSurface, fg: '#567251'},
  timeFormat: {bg: goldenHour.infoSurface, fg: '#6F6886'},
  notifications: {bg: goldenHour.warningSurface, fg: goldenHour.accentStrong},
  privacy: {bg: '#EDE4D4', fg: goldenHour.textSecondary},
  session: {bg: goldenHour.dangerSurface, fg: '#A04D45'},
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
