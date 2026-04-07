import {colors as themeColors} from '../theme';

const sharedThemeColors = {
  text: themeColors.text,
  background: themeColors.background,
  tint: themeColors.accent,
  tabIconDefault: themeColors.textMuted,
  tabIconSelected: themeColors.accent,
};

export default {
  light: sharedThemeColors,
  dark: sharedThemeColors,
};
