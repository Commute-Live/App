import {StyleSheet} from 'react-native';

// Patch StyleSheet.create to inject Geist as the default font.
// This file MUST be imported before expo-router (which eagerly loads all
// route files and their StyleSheet.create calls).
const FONT = 'Geist_400Regular';
const _origCreate = StyleSheet.create.bind(StyleSheet);
(StyleSheet as any).create = function <T extends Record<string, any>>(styles: T): T {
  const patched: any = {};
  for (const key of Object.keys(styles)) {
    const val = styles[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      patched[key] = val.fontFamily ? val : {fontFamily: FONT, ...val};
    } else {
      patched[key] = val;
    }
  }
  return _origCreate(patched);
};
