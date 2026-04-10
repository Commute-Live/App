import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {useAppState} from '../../../state/appState';

const themes: {key: 'mono' | 'metro' | 'bold'; label: string; desc: string}[] = [
  {key: 'mono', label: 'Mono', desc: 'Warm low-glare display'},
  {key: 'metro', label: 'Metro', desc: 'Burnt orange transit accent'},
  {key: 'bold', label: 'Bold', desc: 'High contrast golden hour'},
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

export default function ChangeLayoutScreen() {
  const {state, setTheme, setBehavior, setDensity} = useAppState();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
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
    </SafeAreaView>
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
  content: {padding: layout.screenPadding, gap: spacing.sm},
  section: {marginBottom: layout.screenGap},
  sectionTitle: {color: colors.text, fontSize: typography.bodyLg, fontWeight: '700', marginBottom: spacing.sm},
  grid: {flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap'},
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPadding,
  },
  cardSelected: {borderColor: colors.accent},
  cardLabel: {color: colors.text, fontWeight: '700', fontSize: typography.bodyLg},
  cardDesc: {color: colors.textMuted, marginTop: spacing.xxs, fontSize: typography.body},
  cardChip: {color: colors.accent, marginTop: spacing.sm, fontSize: typography.label, fontWeight: '700'},
});
