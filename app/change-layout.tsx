import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {ScreenHeader} from '../components/ScreenHeader';
import {colors, spacing, radii} from '../theme';
import {useAppState} from '../state/appState';

const themes: {key: 'mono' | 'metro' | 'bold'; label: string; desc: string}[] = [
  {key: 'mono', label: 'Mono', desc: 'Muted OLED friendly'},
  {key: 'metro', label: 'Metro', desc: 'Blue accent, transit vibe'},
  {key: 'bold', label: 'Bold', desc: 'High contrast headlines'},
];

const behaviors = [
  {key: 'stationary', label: 'Stationary', desc: 'Static rows'},
  {key: 'scroll', label: 'Scroll', desc: 'Ticker scrolling'},
  {key: 'rotate', label: 'Rotate', desc: 'Cycles lines every 10s'},
];

const densities = [
  {key: 'large', label: 'Large', desc: 'Big type, 3 rows'},
  {key: 'compact', label: 'Compact', desc: 'More rows, tighter spacing'},
];

export default function ChangeLayout() {
  const {state, setTheme, setBehavior, setDensity} = useAppState();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Change Layout" />

      <Section title="Theme">
        <View style={styles.grid}>
          {themes.map(item => (
            <Selectable
              key={item.key}
              label={item.label}
              desc={item.desc}
              selected={state.theme === item.key}
              onPress={() => setTheme(item.key)}
            />
          ))}
        </View>
      </Section>

      <Section title="Behavior">
        {behaviors.map(item => (
          <Selectable
            key={item.key}
            label={item.label}
            desc={item.desc}
            selected={state.behavior === item.key}
            onPress={() => setBehavior(item.key as any)}
          />
        ))}
      </Section>

      <Section title="Density">
        <View style={styles.grid}>
          {densities.map(item => (
            <Selectable
              key={item.key}
              label={item.label}
              desc={item.desc}
              selected={state.density === item.key}
              onPress={() => setDensity(item.key as any)}
            />
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}

const Section = ({title, children}: {title: string; children: React.ReactNode}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Selectable = ({
  label,
  desc,
  selected,
  onPress,
}: {
  label: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={[styles.card, selected && styles.cardSelected]}>
    <Text style={styles.cardLabel}>{label}</Text>
    <Text style={styles.cardDesc}>{desc}</Text>
    <Text style={styles.cardChip}>{selected ? 'Selected' : 'Tap to use'}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg},
  section: {marginBottom: spacing.lg},
  sectionTitle: {color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: spacing.sm},
  grid: {flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap'},
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardSelected: {borderColor: colors.accent},
  cardLabel: {color: colors.text, fontWeight: '700', fontSize: 15},
  cardDesc: {color: colors.textMuted, marginTop: 4, fontSize: 13},
  cardChip: {color: colors.accent, marginTop: spacing.sm, fontSize: 12, fontWeight: '700'},
});
