import {StyleSheet} from 'react-native';
import {resolveFontFamily} from '../theme';

const shouldPatchTextStyle = (style: unknown) => {
  if (!style || Array.isArray(style) || typeof style !== 'object') {
    return false;
  }

  const textStyle = style as {fontFamily?: string; fontSize?: number; lineHeight?: number};
  return (
    !textStyle.fontFamily &&
    typeof textStyle.fontSize === 'number' &&
    textStyle.fontSize >= 11 &&
    textStyle.lineHeight !== 0
  );
};

const patchStyleValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(patchStyleValue);
  }

  if (!shouldPatchTextStyle(value)) {
    return value;
  }

  return {
    ...(value as object),
    fontFamily: resolveFontFamily(value as {fontStyle?: unknown; fontWeight?: unknown}),
  };
};

const originalCreate = StyleSheet.create;

StyleSheet.create = function patchedCreate<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  styles: T,
): T {
  const patchedEntries = Object.entries(styles).map(([key, value]) => [key, patchStyleValue(value)]);
  return originalCreate(Object.fromEntries(patchedEntries) as T);
};
