export const colors = {
  background: '#030303',
  surface: '#0B0B0F',
  card: '#0F1115',
  accent: '#5CE1E6',
  accentMuted: '#2B6E78',
  text: '#E9ECEF',
  textMuted: '#9AA0A6',
  border: '#191B1F',
  success: '#6EE7B7',
  warning: '#FBBF24',
};

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
