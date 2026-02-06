import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {ScreenHeader} from '../components/ScreenHeader';
import {colors, spacing, radii} from '../theme';
import {useAppState} from '../state/appState';

export default function Brightness() {
  const {state, setBrightness, toggleAutoDim} = useAppState();

  const adjust = (delta: number) => setBrightness(state.brightness + delta);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Brightness" />

      <View style={styles.card}>
        <Text style={styles.heading}>Display brightness</Text>
        <Text style={styles.value}>{state.brightness}%</Text>
        <View style={styles.row}>
          <Pressable style={styles.btn} onPress={() => adjust(-5)}>
            <Text style={styles.btnText}>-</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={() => adjust(5)}>
            <Text style={styles.btnText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, {width: `${state.brightness}%`}]} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Auto-dim</Text>
        <Text style={styles.muted}>Dim overnight (11:00pm – 6:00am)</Text>
        <Pressable
          style={[styles.toggle, state.autoDim && styles.toggleOn]}
          onPress={() => toggleAutoDim(!state.autoDim)}>
          <Text style={styles.toggleText}>{state.autoDim ? 'On' : 'Off'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg},
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heading: {color: colors.text, fontSize: 16, fontWeight: '700'},
  value: {color: colors.accent, fontSize: 32, fontWeight: '800', marginVertical: spacing.sm},
  row: {flexDirection: 'row', gap: spacing.sm},
  btn: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: '#0D1116',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnText: {color: colors.text, fontSize: 18, fontWeight: '700'},
  track: {
    marginTop: spacing.md,
    height: 10,
    backgroundColor: '#0C0C0C',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fill: {height: '100%', backgroundColor: colors.accent},
  muted: {color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm},
  toggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0D1116',
  },
  toggleOn: {borderColor: colors.accent},
  toggleText: {color: colors.text, fontWeight: '700'},
});
