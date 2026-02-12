import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {PreviewCard} from '../../../components/PreviewCard';
import {BottomNav, BottomNavItem} from '../../../components/BottomNav';
import {colors, spacing, radii} from '../../../theme';
import {useSelectedDevice} from '../../../hooks/useSelectedDevice';

const API_BASE = 'https://api.commutelive.com';
const NYC_LINES = ['1', '2', '3', '4', '5', '6', '7', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'J', 'L', 'M', 'N', 'Q', 'R', 'W', 'Z'];
const DEFAULT_STOP_ID = '725N';
const MAX_SELECTED_LINES = 2;

const navItems: BottomNavItem[] = [
  {key: 'stations', label: 'Stations', icon: 'train-outline', route: '/edit-stations'},
  {key: 'layout', label: 'Layout', icon: 'color-palette-outline', route: '/change-layout'},
  {key: 'bright', label: 'Bright', icon: 'sunny-outline', route: '/brightness'},
  {key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings'},
];

export default function DashboardScreen() {
  const selectedDevice = useSelectedDevice();
  const [selectedLines, setSelectedLines] = useState<string[]>(['E', 'A']);
  const [stopId, setStopId] = useState(DEFAULT_STOP_ID);
  const [direction, setDirection] = useState<'N' | 'S'>('N');
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_BASE}/device/${selectedDevice.id}/config`);
        if (!response.ok) return;
        const data = await response.json();
        const configuredLines = Array.isArray(data?.config?.lines)
          ? data.config.lines
              .map((line: any) => (typeof line?.line === 'string' ? line.line.toUpperCase() : ''))
              .filter((line: string) => line.length > 0)
          : [];
        const firstStopId = typeof data?.config?.lines?.[0]?.stop === 'string' ? data.config.lines[0].stop : '';
        const firstDirection = typeof data?.config?.lines?.[0]?.direction === 'string'
          ? data.config.lines[0].direction.toUpperCase()
          : '';

        if (!cancelled && configuredLines.length > 0) {
          setSelectedLines(configuredLines.slice(0, MAX_SELECTED_LINES));
        }
        if (!cancelled && firstStopId.length > 0) {
          setStopId(firstStopId);
        }
        if (!cancelled && (firstDirection === 'N' || firstDirection === 'S')) {
          setDirection(firstDirection);
        }
      } catch {
        // Ignore network/read errors; keep default line.
      }
    };

    if (selectedDevice.id) {
      loadConfig();
    }

    return () => {
      cancelled = true;
    };
  }, [selectedDevice.id]);

  const toggleLine = useCallback((line: string) => {
    setStatusText('');
    setSelectedLines(prev => {
      if (prev.includes(line)) {
        return prev.filter(item => item !== line);
      }
      if (prev.length >= MAX_SELECTED_LINES) {
        return [...prev.slice(1), line];
      }
      return [...prev, line];
    });
  }, []);

  const saveConfig = useCallback(
    async () => {
      if (!selectedDevice.id) return;
      setIsSaving(true);
      setStatusText('');
      if (selectedLines.length === 0) {
        setStatusText('Select at least one line');
        setIsSaving(false);
        return;
      }

      const normalizedStopId = stopId.trim().toUpperCase();
      if (!normalizedStopId.length) {
        setStatusText('Enter a stop ID');
        setIsSaving(false);
        return;
      }
      try {
        const configResponse = await fetch(`${API_BASE}/device/${selectedDevice.id}/config`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            lines: selectedLines.map(line => ({
                provider: 'mta',
                line,
                stop: normalizedStopId,
                direction,
              })),
          }),
        });
        if (!configResponse.ok) {
          setStatusText('Failed to save line');
          return;
        }

        await fetch(`${API_BASE}/refresh/device/${selectedDevice.id}`, {method: 'POST'});
        setStatusText(`Updated ${selectedLines.join(', ')} at ${normalizedStopId} ${direction}`);
      } catch {
        setStatusText('Network error');
      } finally {
        setIsSaving(false);
      }
    },
    [selectedDevice.id, selectedLines, stopId, direction],
  );

  const lineButtons = useMemo(
    () =>
      NYC_LINES.map(line => (
        <Pressable
          key={line}
          style={[styles.lineChip, selectedLines.includes(line) && styles.lineChipActive]}
          onPress={() => toggleLine(line)}
          disabled={isSaving}>
          <Text style={[styles.lineChipText, selectedLines.includes(line) && styles.lineChipTextActive]}>
            {line}
          </Text>
        </Pressable>
      )),
    [selectedLines, toggleLine, isSaving],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.deviceHeaderCard}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.heading}>{selectedDevice.name}</Text>
                <Text style={styles.subheading}>Device ID: {selectedDevice.id}</Text>
              </View>
              <View style={styles.statusChip}>
                <View
                  style={[
                    styles.statusDot,
                    selectedDevice.status === 'Online'
                      ? styles.statusDotOnline
                      : styles.statusDotOffline,
                  ]}
                />
                <Text style={styles.statusText}>{selectedDevice.status}</Text>
              </View>
            </View>
          </View>

          <View style={styles.linePickerCard}>
            <Text style={styles.linePickerTitle}>Pick Stop + Lines</Text>
            <Text style={styles.linePickerSubtitle}>Select up to 2 lines. Example: E + A at 725N.</Text>

            <Text style={styles.formLabel}>Stop ID</Text>
            <TextInput
              value={stopId}
              onChangeText={setStopId}
              autoCapitalize="characters"
              style={styles.input}
              placeholder="e.g. 725N"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.formLabel}>Direction</Text>
            <View style={styles.directionRow}>
              <Pressable
                onPress={() => setDirection('N')}
                style={[styles.directionChip, direction === 'N' && styles.directionChipActive]}>
                <Text style={[styles.directionChipText, direction === 'N' && styles.directionChipTextActive]}>Northbound</Text>
              </Pressable>
              <Pressable
                onPress={() => setDirection('S')}
                style={[styles.directionChip, direction === 'S' && styles.directionChipActive]}>
                <Text style={[styles.directionChipText, direction === 'S' && styles.directionChipTextActive]}>Southbound</Text>
              </Pressable>
            </View>

            <Text style={styles.destFixed}>Selected lines: {selectedLines.join(', ') || 'None'}</Text>

            <View style={styles.lineGrid}>{lineButtons}</View>
            <Pressable style={styles.saveButton} onPress={saveConfig} disabled={isSaving}>
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save to Device'}</Text>
            </Pressable>
            {!!statusText && <Text style={styles.statusNote}>{statusText}</Text>}
          </View>

          <PreviewCard />
        </ScrollView>

        <BottomNav items={navItems} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  body: {flex: 1},
  scroll: {flex: 1},
  content: {padding: spacing.lg},
  deviceHeaderCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  heading: {color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 1},
  subheading: {color: colors.textMuted, fontSize: 10},
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  statusDot: {width: 6, height: 6, borderRadius: 3},
  statusDotOnline: {backgroundColor: colors.success},
  statusDotOffline: {backgroundColor: colors.warning},
  statusText: {color: colors.text, fontSize: 10, fontWeight: '700'},
  linePickerCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  linePickerTitle: {color: colors.text, fontSize: 14, fontWeight: '800'},
  linePickerSubtitle: {color: colors.textMuted, fontSize: 11, marginTop: 2, marginBottom: spacing.sm},
  formLabel: {color: colors.textMuted, fontSize: 11, marginBottom: 4},
  input: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  directionRow: {flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm},
  directionChip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  directionChipActive: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  directionChipText: {color: colors.text, fontSize: 11, fontWeight: '700'},
  directionChipTextActive: {color: colors.accent},
  destFixed: {color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm},
  lineGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  lineChip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  lineChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  lineChipText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  lineChipTextActive: {color: colors.accent},
  saveButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  saveButtonText: {color: colors.background, fontSize: 12, fontWeight: '800'},
  statusNote: {color: colors.textMuted, fontSize: 11, marginTop: spacing.sm},
});
