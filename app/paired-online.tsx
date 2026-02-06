import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {PreviewCard} from '../components/PreviewCard';
import {useAppState} from '../state/appState';
import {colors, spacing, radii} from '../theme';

const fallbackDevice = {id: 'commutelive-001', name: 'Commute Live Display'};

export default function PairedOnline() {
  const [open, setOpen] = useState(false);
  const {
    state: {deviceId},
  } = useAppState();
  const devices = [
    {
      id: deviceId ?? fallbackDevice.id,
      name: deviceId ? `Device ${deviceId}` : fallbackDevice.name,
    },
  ];
  const [selected, setSelected] = useState(devices[0]);

  useEffect(() => {
    setSelected(devices[0]);
  }, [deviceId]);
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topSpacer} />

        <Pressable style={styles.dropdown} onPress={() => setOpen(prev => !prev)}>
          <View style={styles.dropdownRow}>
            <View>
              <Text style={styles.dropdownLabel}>Device</Text>
              <Text style={styles.dropdownValue}>{selected.name}</Text>
              <Text style={styles.dropdownMeta}>Connected • ID {selected.id}</Text>
            </View>
            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </View>
        </Pressable>

        <View style={styles.previewWrap}>
          <PreviewCard />
        </View>

        {open ? (
          <View style={styles.dropdownList}>
            {devices.map(device => (
              <Pressable
                key={device.id}
                style={({pressed}) => [styles.dropdownItem, pressed && styles.pressed]}
                onPress={() => {
                  setSelected(device);
                  setOpen(false);
                }}>
                <View>
                  <Text style={styles.dropdownValue}>{device.name}</Text>
                  <Text style={styles.dropdownMeta}>Connected • ID {device.id}</Text>
                </View>
                {selected.id === device.id ? (
                  <Ionicons name="checkmark" size={16} color={colors.accent} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem}>
          <Ionicons name="home-outline" size={18} color={colors.text} />
          <Text style={styles.navLabel}>Home</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <Ionicons name="time-outline" size={18} color={colors.textMuted} />
          <Text style={styles.navLabelMuted}>History</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <Ionicons name="settings-outline" size={18} color={colors.textMuted} />
          <Text style={styles.navLabelMuted}>Settings</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xl + 64},
  dropdown: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  dropdownRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  dropdownLabel: {color: colors.textMuted, fontSize: 12},
  dropdownValue: {color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2},
  dropdownMeta: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  dropdownList: {
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  topSpacer: {height: spacing.xl},
  previewWrap: {marginTop: spacing.md},
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomNav: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {alignItems: 'center', gap: 4},
  navLabel: {color: colors.text, fontSize: 11, fontWeight: '700'},
  navLabelMuted: {color: colors.textMuted, fontSize: 11, fontWeight: '600'},
  pressed: {opacity: 0.85},
});
