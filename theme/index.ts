export const colors = {
  background: '#030303',
  surface: '#0B0B0F',
  surfaceMuted: '#0B0F13',
  card: '#0F1115',
  accentSurface: '#0F1A1D',
  accent: '#5CE1E6',
  accentMuted: '#2B6E78',
  text: '#E9ECEF',
  textMuted: '#9AA0A6',
  border: '#191B1F',
  success: '#6EE7B7',
  warning: '#FBBF24',
  overlay: 'rgba(0, 0, 0, 0.55)',
  overlayStrong: '#00000088',
  shadow: '#000000',
  glassSurface: 'rgba(255,255,255,0.04)',
  glassSurfaceStrong: 'rgba(255,255,255,0.06)',
  selectionSurface: '#0B1115',
  successSurface: '#0E2B21',
  successSurfaceStrong: '#0A2218',
  successSurfacePreview: '#0B3B2E',
  successBorder: '#1B5E4A',
  successText: '#34D399',
  successTextSoft: '#7CE4BF',
  dangerSurface: '#2B1010',
  dangerSurfaceMuted: '#160A0A',
  dangerBorder: '#5B1C1C',
  dangerBorderMuted: '#2A1212',
  dangerText: '#FCA5A5',
  dangerTextSoft: '#F87171',
  info: '#7DD3FC',
  previewSurface: '#020204',
  previewSurfaceMuted: '#090C12',
  previewSurfaceActive: '#0E1720',
  previewBorder: '#0F131A',
  previewBorderMuted: '#1E232B',
  previewBadgeBorder: '#38414A',
  previewText: '#E9F5FF',
  previewTextMuted: '#C7CFD6',
  routeFallback: '#0C7A59',
  routeFallbackText: '#E8FFF8',
  highlight: '#E5C15A',
  editorStepComplete: '#10B981',
  selectionSurfaceStrong: '#091410',
  editorPanelBorder: 'rgba(255,255,255,0.08)',
  editorPanelBorderStrong: 'rgba(255,255,255,0.12)',
  editorPanelBorderSoft: 'rgba(255,255,255,0.06)',
  editorPanelBorderInteractive: 'rgba(255,255,255,0.1)',
  editorPanelSurface: 'rgba(11, 16, 24, 0.84)',
  editorPanelSurfaceMuted: 'rgba(5, 10, 16, 0.54)',
  editorPanelSurfaceStrong: 'rgba(12, 16, 22, 0.82)',
  editorPanelSurfaceActive: 'rgba(17, 29, 38, 0.96)',
  editorPanelSurfaceCard: 'rgba(8, 12, 18, 0.82)',
  editorAccentGhost: 'rgba(255,255,255,0.18)',
  editorProgressTrack: 'rgba(255,255,255,0.09)',
  editorProgressFill: 'rgba(92, 225, 230, 0.45)',
  editorProgressDotSurface: '#0B1018',
  editorProgressDotActiveSurface: '#173041',
  editorProgressDotCompleteSurface: '#123239',
  editorTextStrong: '#F4F8FC',
  editorTextStrongAlt: '#FFFFFF',
  editorTextSoft: '#D8E4EF',
  editorTextSoftAlt: '#C9D8E6',
  editorTextMutedSoft: '#8EA0B4',
  editorTextMutedStrong: '#9FB0C2',
  editorFormatCardBorder: '#242933',
  editorFormatCardSurface: '#12161C',
  editorFormatSkeleton: '#1C2330',
  editorFormatDivider: '#262C35',
  editorMockSurface: '#04070A',
  editorMockBorder: 'rgba(255,255,255,0.06)',
  editorMockBorderActive: 'rgba(92,225,230,0.2)',
  controlSurface: '#0D1116',
  controlTrack: '#0C0C0C',
  displayShellSurface: '#0A0D12',
  displaySlotSurface: '#0D131A',
  displaySlotActiveSurface: '#13222E',
  displayTitle: '#E4EDF6',
  displayPlaceholder: '#5C6670',
  displaySubtleText: '#8B9EAD',
  displayTimeText: '#D7E3EF',
};

export const settingsSectionColors = {
  account: {bg: '#1A2744', fg: '#6EA8FE'},
  device: {bg: '#1A2B1A', fg: '#6EE7B7'},
  timeFormat: {bg: '#1E1A2B', fg: '#C4B5FD'},
  notifications: {bg: '#2B1A1A', fg: '#FCA5A5'},
  privacy: {bg: '#1A2428', fg: '#67E8F9'},
  session: {bg: '#241A28', fg: '#F9A8D4'},
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
  caption: 11,
  label: 12,
  body: 13,
  bodyLg: 14,
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

export const fonts = {
  light: 'Rubik_300Light',
  lightItalic: 'Rubik_300LightItalic',
  sans: 'Rubik_400Regular',
  sansItalic: 'Rubik_400Italic',
  medium: 'Rubik_500Medium',
  mediumItalic: 'Rubik_500MediumItalic',
  semiBold: 'Rubik_600SemiBold',
  semiBoldItalic: 'Rubik_600SemiBoldItalic',
  bold: 'Rubik_700Bold',
  boldItalic: 'Rubik_700BoldItalic',
  extraBold: 'Rubik_800ExtraBold',
  extraBoldItalic: 'Rubik_800ExtraBoldItalic',
  black: 'Rubik_900Black',
  blackItalic: 'Rubik_900BlackItalic',
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
