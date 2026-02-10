import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {PreviewCard} from '../../../components/PreviewCard';
import {useAppState} from '../../../state/appState';
import {colors, spacing, radii} from '../../../theme';

const fallbackDevice = {id: 'commutelive-001', name: 'Commute Live Display'};

export default function PairedOnlineScreen() {
  const [open, setOpen] = useState(false);
  const [linkStatus, setLinkStatus] = useState<'idle' | 'linking' | 'linked' | 'error'>('idle');
  const [linkMessage, setLinkMessage] = useState('');
  const {
    state: {deviceId, userId},
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

  useEffect(() => {
    if (!deviceId || !userId) return;
    if (linkStatus !== 'idle') return;
    const linkDevice = async () => {
      setLinkStatus('linking');
      setLinkMessage('');
      try {
        const response = await fetch('https://api.commutelive.com/user/device/link', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId, deviceId}),
        });
        const text = await response.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
        if (!response.ok) {
          setLinkStatus('error');
          setLinkMessage(data?.error || text || 'Link failed.');
          return;
        }
        setLinkStatus('linked');
        setLinkMessage(data?.message || 'Device linked successfully.');
      } catch {
        setLinkStatus('error');
        setLinkMessage('Network error.');
      }
    };
    linkDevice();
  }, [deviceId, userId, linkStatus]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Device ID</Text>
          <Text style={styles.infoValue}>{deviceId || 'Not available yet'}</Text>
          <Text style={styles.infoLabel}>User ID</Text>
          <Text style={styles.infoValue}>{userId || 'Not available yet'}</Text>
          <Text style={styles.linkStatus}>
            {linkStatus === 'linking'
              ? 'Linking device...'
              : linkStatus === 'linked'
                ? 'Device linked'
                : linkStatus === 'error'
                  ? 'Device link failed'
                  : ''}
          </Text>
          {linkMessage ? <Text style={styles.linkMessage}>{linkMessage}</Text> : null}
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
    </SafeAreaView>
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
  infoCard: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  infoLabel: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  infoValue: {color: colors.text, fontWeight: '800', marginTop: 4, marginBottom: spacing.sm},
  linkStatus: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  linkMessage: {color: colors.textMuted, fontSize: 12, marginTop: 4},
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
