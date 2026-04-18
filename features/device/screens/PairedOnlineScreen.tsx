import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {useMutation} from '@tanstack/react-query';
import {PreviewCard} from '../../../components/PreviewCard';
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {apiFetch} from '../../../lib/api';
import {useAuth} from '../../../state/authProvider';
import {logger} from '../../../lib/logger';

const fallbackDevice = {id: 'commutelive-001', name: 'My Device'};

export default function PairedOnlineScreen() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [linkStatus, setLinkStatus] = useState<'idle' | 'linking' | 'linked' | 'error'>('idle');
  const [linkMessage, setLinkMessage] = useState('');
  const {deviceId, user, clearAuth} = useAuth();
  const userId = user?.id ?? null;
  const devices = useMemo(() => [
    {
      id: deviceId ?? fallbackDevice.id,
      name: fallbackDevice.name,
    },
  ], [deviceId]);
  const [selected, setSelected] = useState(devices[0]);

  const linkDeviceMutation = useMutation({
    mutationFn: async (nextDeviceId: string) => {
      const response = await apiFetch('/user/device/link', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({deviceId: nextDeviceId}),
      });
      const text = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      if (!response.ok) {
        if (data?.error === 'REFRESH_INVALID' || data?.error === 'REFRESH_REUSED') {
          return {ok: false as const, authExpired: true, message: data?.error};
        }
        if (data?.error === 'DEVICE_COMMAND_CLEAR_FAILED') {
          return {
            ok: false as const,
            authExpired: false,
            message: 'Could not finish pairing right now. Try again in a moment.',
          };
        }
        return {ok: false as const, authExpired: false, message: data?.error || text || 'Link failed.'};
      }
      return {ok: true as const, message: data?.message || 'Device linked successfully.'};
    },
  });

  useEffect(() => {
    setSelected(devices[0]);
  }, [deviceId, devices]);

  useEffect(() => {
    if (!deviceId || !userId) return;
    if (linkStatus !== 'idle') return;
    setLinkStatus('linking');
    setLinkMessage('');
    linkDeviceMutation.mutate(deviceId, {
      onSuccess: result => {
        if (!result.ok && result.authExpired) {
          clearAuth();
          router.replace('/auth');
          return;
        }
        if (!result.ok) {
          logger.error('Device link failed', {userId, deviceId, error: result.message});
          setLinkStatus('error');
          setLinkMessage(result.message);
          return;
        }
        logger.info('Device linked successfully', {userId, deviceId});
        setLinkStatus('linked');
        setLinkMessage(result.message);
      },
      onError: () => {
        logger.error('Device link network error', {userId, deviceId});
        setLinkStatus('error');
        setLinkMessage('Network error.');
      },
    });
  }, [clearAuth, deviceId, linkDeviceMutation, linkStatus, router, userId]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topSpacer} />

        <Pressable style={styles.dropdown} onPress={() => setOpen(prev => !prev)}>
          <View style={styles.dropdownRow}>
            <View>
              <Text style={styles.dropdownLabel}>Device</Text>
              <Text style={styles.dropdownValue}>{selected.name}</Text>
              <Text style={styles.dropdownMeta}>Connected</Text>
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
          <Text style={styles.infoLabel}>Display</Text>
          <Text style={styles.infoValue}>{selected.name}</Text>
          <Text style={styles.infoLabel}>Account</Text>
          <Text style={styles.infoValue}>{userId ? 'Signed in' : 'Not signed in'}</Text>
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
                  <Text style={styles.dropdownMeta}>Connected</Text>
                </View>
                {selected.id === device.id ? (
                  <Ionicons name="checkmark" size={16} color={colors.accent} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: layout.screenPadding, paddingBottom: spacing.xxl, gap: spacing.md},
  dropdown: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPadding,
  },
  dropdownRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm},
  dropdownLabel: {color: colors.textMuted, fontSize: typography.label},
  dropdownValue: {color: colors.text, fontSize: typography.bodyLg, fontWeight: '700', marginTop: spacing.xxs},
  dropdownMeta: {color: colors.textMuted, fontSize: typography.label, marginTop: spacing.xxs},
  dropdownList: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  topSpacer: {height: spacing.xl},
  previewWrap: {},
  infoCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPadding,
    gap: spacing.xxs,
  },
  infoLabel: {color: colors.textMuted, fontSize: typography.label, fontWeight: '700'},
  infoValue: {color: colors.text, fontWeight: '800', marginTop: spacing.xxs, marginBottom: spacing.sm},
  linkStatus: {color: colors.textMuted, fontSize: typography.label, fontWeight: '700', marginTop: spacing.xxs},
  linkMessage: {color: colors.textMuted, fontSize: typography.label, marginTop: spacing.xxs},
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: {opacity: 0.85},
});
