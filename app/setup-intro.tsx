import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {ScreenHeader} from '../components/ScreenHeader';
import {colors, spacing, radii} from '../theme';
import {WebView} from 'react-native-webview';
import {useAppState} from '../state/appState';

export default function SetupIntro() {
  const router = useRouter();
  const {setDeviceStatus, setDeviceId} = useAppState();
  const setupSsid = 'Commute-Live-Setup-xxx';
  const [portalError, setPortalError] = useState(false);
  const portalUrl = 'http://192.168.4.1/';
  const statusUrl = 'http://192.168.4.1/status';
  const canShowPortal = true;

  useEffect(() => {
    setDeviceStatus('notPaired');

    const loadStatus = async () => {
      try {
        const response = await fetch(statusUrl, {method: 'GET'});
        if (!response.ok) return;
        const data = await response.json();
        if (data?.deviceId) {
          setDeviceId(String(data.deviceId));
        }
        if (data?.wifiConnected === true) {
          setDeviceStatus('pairedOnline');
        } else if (data?.wifiConnected === false) {
          setDeviceStatus('pairedOffline');
        }
      } catch {
        // ignore
      }
    };

    loadStatus();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Setup Intro" />

      <Text style={styles.heading}>Connect to Setup Wi‑Fi</Text>
      <Text style={styles.subheading}>
        Make sure your phone is connected to “{setupSsid}”.
      </Text>

      <View style={[styles.card, styles.cardSuccess]}>
        <View style={styles.row}>
          <View style={[styles.statusIcon, styles.statusIconSuccess]}>
            <Ionicons name="checkmark" size={20} color={colors.background} />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.cardTitle}>Connected to “{setupSsid}”</Text>
            <Text style={styles.cardSubtitle}>
              Confirm you're on the setup network before continuing.
            </Text>
          </View>
        </View>
      </View>

      {canShowPortal ? (
        <View style={styles.portalWrap}>
          <View style={styles.portalHeader}>
            <Text style={styles.portalTitle}>Device Portal</Text>
            <Text style={styles.portalUrl}>{portalUrl}</Text>
          </View>
          <WebView
            source={{uri: portalUrl}}
            originWhitelist={['*']}
            onError={() => setPortalError(true)}
            onHttpError={() => setPortalError(true)}
            style={styles.webView}
          />
          {portalError ? (
            <Text style={styles.portalError}>
              Unable to load the portal. Confirm you're connected to “{setupSsid}”.
            </Text>
          ) : null}
        </View>
      ) : null}

      <Pressable style={styles.card} onPress={() => router.push('/reconnect-help')}>
        <View style={styles.row}>
          <View style={[styles.statusIcon, styles.statusIconWarning]}>
            <Ionicons name="refresh" size={16} color={colors.background} />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.cardTitle}>Can’t see the Wi-Fi?</Text>
            <Text style={styles.cardSubtitle}>
              Reset and plug in your device, then try again.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => router.push('/dashboard')}>
        <Text style={styles.secondaryText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg},
  heading: {color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.xs},
  subheading: {color: colors.textMuted, fontSize: 13, marginBottom: spacing.lg},
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  textWrap: {flex: 1},
  cardTitle: {color: colors.text, fontSize: 15, fontWeight: '700'},
  cardSubtitle: {color: colors.textMuted, fontSize: 12, marginTop: 4},
  cardSuccess: {borderColor: colors.success},
  cardError: {borderColor: colors.warning},
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconSuccess: {backgroundColor: colors.success},
  statusIconWarning: {backgroundColor: colors.warning},
  statusIconError: {backgroundColor: colors.warning},
  portalWrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  portalHeader: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  portalTitle: {color: colors.text, fontSize: 14, fontWeight: '700'},
  portalUrl: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  webView: {height: 380, backgroundColor: colors.surface},
  portalError: {color: colors.warning, fontSize: 12, padding: spacing.md},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryText: {color: colors.textMuted, fontWeight: '700', fontSize: 13},
});
