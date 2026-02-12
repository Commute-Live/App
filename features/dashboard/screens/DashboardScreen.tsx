import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {PreviewCard} from '../../../components/PreviewCard';
import {BottomNav, BottomNavItem} from '../../../components/BottomNav';
import {colors, spacing, radii} from '../../../theme';
import {useSelectedDevice} from '../../../hooks/useSelectedDevice';

const API_BASE = 'https://api.commutelive.com';
const DEFAULT_STOP_ID = '725N';
const MAX_SELECTED_LINES = 2;
type StopOption = {stopId: string; stop: string; direction: 'N' | 'S' | ''};

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
  const [stopName, setStopName] = useState('');
  const [stopQuery, setStopQuery] = useState('');
  const [stopOptions, setStopOptions] = useState<StopOption[]>([]);
  const [stopDropdownOpen, setStopDropdownOpen] = useState(false);
  const [isLoadingStops, setIsLoadingStops] = useState(false);
  const [availableLines, setAvailableLines] = useState<string[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [stopError, setStopError] = useState('');

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
        const firstDirection = typeof data?.config?.lines?.[0]?.direction === 'string' ? data.config.lines[0].direction.toUpperCase() : '';

        if (!cancelled && configuredLines.length > 0) {
          setSelectedLines(configuredLines.slice(0, MAX_SELECTED_LINES));
        }
        if (!cancelled && firstStopId.length > 0) {
          const normalized = firstStopId.toUpperCase();
          setStopId(normalized);
          setStopQuery(normalized);
        }
        if (!cancelled && (firstDirection === 'N' || firstDirection === 'S') && firstStopId.length > 0) {
          setStopId(prev => {
            const base = prev.length ? prev : firstStopId.toUpperCase();
            if (base.endsWith('N') || base.endsWith('S')) return base;
            return `${base}${firstDirection}`;
          });
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

  useEffect(() => {
    let cancelled = false;
    const q = stopQuery.trim();
    if (!stopDropdownOpen) {
      return;
    }

    const run = async () => {
      setIsLoadingStops(true);
      try {
        const queryPart = q.length > 0 ? `&q=${encodeURIComponent(q)}` : '';
        const response = await fetch(`${API_BASE}/stops?limit=1000${queryPart}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          const options = Array.isArray(data?.stops) ? data.stops : [];
          setStopOptions(options);
        }
      } catch {
        if (!cancelled) setStopOptions([]);
      } finally {
        if (!cancelled) setIsLoadingStops(false);
      }
    };

    const t = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [stopQuery, stopDropdownOpen]);

  useEffect(() => {
    let cancelled = false;
    const normalizedStopId = stopId.trim().toUpperCase();
    if (!normalizedStopId) {
      setAvailableLines([]);
      return;
    }

    const run = async () => {
      setIsLoadingLines(true);
      try {
        const response = await fetch(`${API_BASE}/stops/${encodeURIComponent(normalizedStopId)}/lines`);
        if (!response.ok) {
          if (!cancelled) setAvailableLines([]);
          return;
        }

        const data = await response.json();
        const lines = Array.isArray(data?.lines)
          ? data.lines
              .map((line: unknown) => (typeof line === 'string' ? line.toUpperCase() : ''))
              .filter((line: string) => line.length > 0)
          : [];

        if (!cancelled) {
          setAvailableLines(lines);
          setSelectedLines(prev => {
            const filtered = prev.filter(line => lines.includes(line));
            if (filtered.length > 0) return filtered.slice(0, MAX_SELECTED_LINES);
            return lines.slice(0, MAX_SELECTED_LINES);
          });
        }
      } catch {
        if (!cancelled) setAvailableLines([]);
      } finally {
        if (!cancelled) setIsLoadingLines(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [stopId]);

  const derivedDirection: 'N' | 'S' = stopId.toUpperCase().endsWith('S') ? 'S' : 'N';

  const chooseStop = useCallback((option: StopOption) => {
    setStopId(option.stopId.toUpperCase());
    setStopName(option.stop);
    setStopQuery(`${option.stop} (${option.stopId})`);
    setStopOptions([]);
    setStopDropdownOpen(false);
    setStopError('');
    setStatusText('');
  }, []);

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
        setStatusText('Select a stop');
        setStopError('Select a stop from the list');
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
                direction: derivedDirection,
              })),
          }),
        });
        if (!configResponse.ok) {
          setStatusText('Failed to save line');
          return;
        }

        await fetch(`${API_BASE}/refresh/device/${selectedDevice.id}`, {method: 'POST'});
        setStatusText(`Updated ${selectedLines.join(', ')} at ${normalizedStopId} ${derivedDirection}`);
      } catch {
        setStatusText('Network error');
      } finally {
        setIsSaving(false);
      }
    },
    [selectedDevice.id, selectedLines, stopId, derivedDirection],
  );

  const lineButtons = useMemo(
    () =>
      availableLines.map(line => (
        <Pressable
          key={line}
          style={[styles.lineChip, selectedLines.includes(line) && styles.lineChipActive]}
          onPress={() => toggleLine(line)}
          disabled={isSaving || isLoadingLines}>
          <Text style={[styles.lineChipText, selectedLines.includes(line) && styles.lineChipTextActive]}>
            {line}
          </Text>
        </Pressable>
      )),
    [availableLines, selectedLines, toggleLine, isSaving, isLoadingLines],
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
            <Text style={styles.linePickerSubtitle}>Search and select a stop, then select up to 2 lines.</Text>

            <Text style={styles.formLabel}>Stop</Text>
            <TextInput
              value={stopQuery}
              onChangeText={text => {
                setStopQuery(text);
                setStopId('');
                setStopName('');
                setStopDropdownOpen(true);
                setStopError('');
              }}
              onFocus={() => setStopDropdownOpen(true)}
              style={styles.input}
              placeholder="Search stop (e.g. Port Authority or A27N)"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={styles.dropdownToggle} onPress={() => setStopDropdownOpen(prev => !prev)}>
              <Text style={styles.dropdownToggleText}>{stopDropdownOpen ? 'Hide stops' : 'Show all stops'}</Text>
            </Pressable>
            {isLoadingStops && <Text style={styles.hintText}>Searching stops...</Text>}
            {stopDropdownOpen && !isLoadingStops && stopOptions.length > 0 && (
              <View style={styles.stopList}>
                <ScrollView style={styles.stopListScroll} nestedScrollEnabled>
                  {stopOptions.map(option => (
                    <Pressable key={option.stopId} style={styles.stopItem} onPress={() => chooseStop(option)}>
                      <Text style={styles.stopItemTitle}>{option.stop}</Text>
                      <Text style={styles.stopItemSubtitle}>
                        {option.stopId} {option.direction ? `(${option.direction})` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            {!!stopError && <Text style={styles.errorText}>{stopError}</Text>}

            <Text style={styles.destFixed}>
              Stop ID: {stopId || '--'} {stopName ? `| ${stopName}` : ''} | Direction: {derivedDirection}
            </Text>
            <Text style={styles.destFixed}>Selected lines: {selectedLines.join(', ') || 'None'}</Text>

            <Text style={styles.formLabel}>Available lines for this stop</Text>
            {isLoadingLines && <Text style={styles.hintText}>Loading lines...</Text>}
            {!isLoadingLines && availableLines.length === 0 && (
              <Text style={styles.hintText}>No lines found for this stop yet.</Text>
            )}
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
    marginBottom: spacing.xs,
  },
  dropdownToggle: {alignSelf: 'flex-start', marginBottom: spacing.sm},
  dropdownToggleText: {color: colors.accent, fontSize: 11, fontWeight: '700'},
  hintText: {color: colors.textMuted, fontSize: 11, marginBottom: spacing.xs},
  errorText: {color: colors.warning, fontSize: 11, marginBottom: spacing.xs},
  stopList: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  stopListScroll: {maxHeight: 260},
  stopItem: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  stopItemTitle: {color: colors.text, fontSize: 12, fontWeight: '700'},
  stopItemSubtitle: {color: colors.textMuted, fontSize: 11},
  directionChip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
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
