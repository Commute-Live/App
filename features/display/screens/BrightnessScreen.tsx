import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {useAppState} from '../../../state/appState';

export default function BrightnessScreen() {
  const {state, setBrightness, toggleAutoDim} = useAppState();

  const adjust = (delta: number) => setBrightness(state.brightness + delta);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: layout.screenPadding, paddingBottom: spacing.xxl, gap: spacing.md},
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPaddingLg,
    gap: spacing.sm,
  },
  heading: {color: colors.text, fontSize: typography.title, fontWeight: '700'},
  value: {color: colors.accent, fontSize: 32, fontWeight: '800', marginVertical: spacing.sm},
  row: {flexDirection: 'row', gap: spacing.sm},
  btn: {
    flex: 1,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    backgroundColor: colors.controlSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {color: colors.text, fontSize: 18, fontWeight: '700'},
  track: {
    marginTop: spacing.md,
    height: 10,
    backgroundColor: colors.controlTrack,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fill: {height: '100%', backgroundColor: colors.accent},
  muted: {color: colors.textMuted, fontSize: typography.body, marginTop: spacing.xxs},
  toggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.controlSurface,
    justifyContent: 'center',
  },
  toggleOn: {borderColor: colors.accent},
  toggleText: {color: colors.text, fontWeight: '700'},
});
