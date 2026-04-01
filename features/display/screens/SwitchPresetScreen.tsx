import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {Preset, useAppState} from '../../../state/appState';

const PRESETS: Preset[] = [
  {
    name: 'Morning Commute',
    description: 'Bigger text, calm colors, 70% brightness',
    theme: 'mono',
    behavior: 'stationary',
    density: 'large',
    brightness: 70,
  },
  {
    name: 'Evening Calm',
    description: 'Dimmed, slow rotate, 35% brightness',
    theme: 'metro',
    behavior: 'rotate',
    density: 'large',
    brightness: 35,
  },
  {
    name: 'Event Mode',
    description: 'Bold theme, scroll ticker, 90% brightness',
    theme: 'bold',
    behavior: 'scroll',
    density: 'compact',
    brightness: 90,
  },
];

export default function SwitchPresetScreen() {
  const {state, applyPreset} = useAppState();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Switch Preset" />
        {PRESETS.map(preset => (
          <Pressable
            key={preset.name}
            onPress={() => applyPreset(preset)}
            style={[styles.card, state.preset === preset.name && styles.active]}>
            <View style={{flex: 1}}>
              <Text style={styles.title}>{preset.name}</Text>
              <Text style={styles.desc}>{preset.description}</Text>
            </View>
            <Text style={styles.chip}>{state.preset === preset.name ? 'Active' : 'Apply'}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: layout.screenPadding, gap: spacing.md},
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    minHeight: 88,
    padding: layout.cardPadding,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  active: {borderColor: colors.accent},
  title: {color: colors.text, fontSize: typography.title, fontWeight: '700'},
  desc: {color: colors.textMuted, marginTop: spacing.xxs, fontSize: typography.body},
  chip: {color: colors.accent, fontWeight: '700', fontSize: typography.label},
});
