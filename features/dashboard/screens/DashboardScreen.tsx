import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {BottomNav, BottomNavItem} from '../../../components/BottomNav';
import {colors, spacing, radii} from '../../../theme';
import {useSelectedDevice} from '../../../hooks/useSelectedDevice';

const API_BASE = 'https://api.commutelive.com';
const DEFAULT_STOP_ID = '725N';
const DEFAULT_STOP_NAME = 'Times Sq-42 St';
const CTA_DEFAULT_STOP_ID = '40380';
const CTA_DEFAULT_STOP_NAME = 'Clark/Lake';
const MAX_SELECTED_LINES = 2;
type StopOption = {stopId: string; stop: string; direction: 'N' | 'S' | ''};
type ProviderOption = {id: 'mta-subway' | 'cta-subway'; label: string};

const providerOptions: ProviderOption[] = [
  {id: 'mta-subway', label: 'NYC Subway'},
  {id: 'cta-subway', label: 'Chicago Subway'},
];

const CTA_LINES = ['RED', 'BLUE', 'BRN', 'G', 'ORG', 'P', 'PINK', 'Y'];
const CTA_STOPS: StopOption[] = [
  {stopId: '40380', stop: 'Clark/Lake', direction: ''},
  {stopId: '41400', stop: 'Roosevelt', direction: ''},
  {stopId: '40900', stop: 'Howard', direction: ''},
  {stopId: '40890', stop: "O'Hare", direction: ''},
  {stopId: '40450', stop: '95th/Dan Ryan', direction: ''},
];

const navItems: BottomNavItem[] = [
  {key: 'stations', label: 'Stations', icon: 'train-outline', route: '/edit-stations'},
  {key: 'layout', label: 'Layout', icon: 'color-palette-outline', route: '/change-layout'},
  {key: 'bright', label: 'Bright', icon: 'sunny-outline', route: '/brightness'},
  {key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings'},
];

export default function DashboardScreen() {
  const selectedDevice = useSelectedDevice();
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption['id']>('mta-subway');
  const [selectedLines, setSelectedLines] = useState<string[]>(['E', 'A']);
  const [stopId, setStopId] = useState(DEFAULT_STOP_ID);
  const [stopName, setStopName] = useState(DEFAULT_STOP_NAME);
  const [allStops, setAllStops] = useState<StopOption[]>([]);
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
        const firstProvider = typeof data?.config?.lines?.[0]?.provider === 'string' ? data.config.lines[0].provider : '';

        if (!cancelled && (firstProvider === 'mta-subway' || firstProvider === 'cta-subway')) {
          setSelectedProvider(firstProvider);
        }

        if (!cancelled && configuredLines.length > 0) {
          setSelectedLines(configuredLines.slice(0, MAX_SELECTED_LINES));
        }
        if (!cancelled && firstStopId.length > 0) {
          const normalized = firstStopId.toUpperCase();
          setStopId(normalized);
        }
        if (
          !cancelled &&
          firstProvider !== 'cta-subway' &&
          (firstDirection === 'N' || firstDirection === 'S') &&
          firstStopId.length > 0
        ) {
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
    if (selectedProvider === 'cta-subway') {
      setAllStops(CTA_STOPS);
      setStopOptions(stopDropdownOpen ? CTA_STOPS : []);
      setAvailableLines(CTA_LINES);
      setSelectedLines(prev => {
        const filtered = prev.filter(line => CTA_LINES.includes(line));
        if (filtered.length > 0) return filtered.slice(0, MAX_SELECTED_LINES);
        return CTA_LINES.slice(0, MAX_SELECTED_LINES);
      });
      if (!stopId || stopId.endsWith('N') || stopId.endsWith('S')) {
        setStopId(CTA_DEFAULT_STOP_ID);
        setStopName(CTA_DEFAULT_STOP_NAME);
      }
      return;
    }

    let cancelled = false;
    if (!stopDropdownOpen) {
      return;
    }

    const run = async () => {
      if (allStops.length > 0) {
        return;
      }
      setIsLoadingStops(true);
      try {
        const response = await fetch(`${API_BASE}/stops?limit=1000`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          const options = Array.isArray(data?.stops) ? data.stops as StopOption[] : [];
          setAllStops(options);
        }
      } catch {
        if (!cancelled) setAllStops([]);
      } finally {
        if (!cancelled) setIsLoadingStops(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [selectedProvider, stopDropdownOpen, allStops.length, stopId]);

  useEffect(() => {
    if (!stopDropdownOpen) {
      setStopOptions([]);
      return;
    }
    if (selectedProvider === 'cta-subway') {
      setStopOptions(CTA_STOPS);
      return;
    }
    setStopOptions(allStops);
  }, [selectedProvider, allStops, stopDropdownOpen]);

  useEffect(() => {
    if (selectedProvider === 'cta-subway') {
      setAvailableLines(CTA_LINES);
      setSelectedLines(prev => {
        const filtered = prev.filter(line => CTA_LINES.includes(line));
        if (filtered.length > 0) return filtered.slice(0, MAX_SELECTED_LINES);
        return CTA_LINES.slice(0, MAX_SELECTED_LINES);
      });
      return;
    }

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
  }, [selectedProvider, stopId]);

  const derivedDirection: 'N' | 'S' = stopId.toUpperCase().endsWith('S') ? 'S' : 'N';

  const chooseStop = useCallback((option: StopOption) => {
    setStopId(option.stopId.toUpperCase());
    setStopName(option.stop);
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
        const directionToSave = selectedProvider === 'cta-subway' ? undefined : derivedDirection;
        const configResponse = await fetch(`${API_BASE}/device/${selectedDevice.id}/config`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            lines: selectedLines.map(line => ({
                provider: selectedProvider,
                line,
                stop: normalizedStopId,
                direction: directionToSave,
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
    [selectedDevice.id, selectedLines, stopId, derivedDirection, selectedProvider],
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
                <Text style={styles.heading}>Your Device</Text>
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

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pick Provider</Text>
            <View style={styles.providerRow}>
              {providerOptions.map(option => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.providerChip,
                    selectedProvider === option.id && styles.providerChipActive,
                  ]}
                  onPress={() => {
                    setSelectedProvider(option.id);
                    setStatusText('');
                    setStopError('');
                    setStopDropdownOpen(false);
                    if (option.id === 'mta-subway') {
                      setStopId(DEFAULT_STOP_ID);
                      setStopName(DEFAULT_STOP_NAME);
                    } else {
                      setStopId(CTA_DEFAULT_STOP_ID);
                      setStopName(CTA_DEFAULT_STOP_NAME);
                    }
                  }}>
                  <Text
                    style={[
                      styles.providerChipText,
                      selectedProvider === option.id && styles.providerChipTextActive,
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pick Station</Text>

            <Pressable
              style={({pressed}) => [
                styles.stationSelector,
                stopDropdownOpen && styles.stationSelectorOpen,
                pressed && styles.stationSelectorPressed,
              ]}
              onPress={() => {
                setStopDropdownOpen(prev => !prev);
                setStopError('');
              }}>
              <Text style={styles.stationSelectorText}>
                {stopName} ({stopId})
              </Text>
              <Text style={styles.stationSelectorCaret}>{stopDropdownOpen ? '▲' : '▼'}</Text>
            </Pressable>

            {isLoadingStops && <Text style={styles.hintText}>Searching stops...</Text>}
            {stopDropdownOpen && !isLoadingStops && stopOptions.length > 0 && (
              <View style={styles.stopList}>
                <ScrollView style={styles.stopListScroll} nestedScrollEnabled>
                  {stopOptions.map(option => {
                    const isSelected = option.stopId.toUpperCase() === stopId.toUpperCase();
                    return (
                      <Pressable
                        key={option.stopId}
                        style={({pressed}) => [
                          styles.stopItem,
                          isSelected && styles.stopItemSelected,
                          pressed && styles.stopItemPressed,
                        ]}
                        onPress={() => chooseStop(option)}>
                        <Text style={styles.stopItemTitle}>{option.stop}</Text>
                        <Text style={styles.stopItemSubtitle}>
                          {option.stopId} {option.direction ? `(${option.direction})` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            {!!stopError && <Text style={styles.errorText}>{stopError}</Text>}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pick Trains</Text>
            <Text style={styles.hintText}>Select up to 2 lines for {stopId}.</Text>
            <Text style={styles.destFixed}>Selected: {selectedLines.join(', ') || 'None'}</Text>

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
  sectionCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.sm},
  stationSelector: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stationSelectorOpen: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  stationSelectorPressed: {opacity: 0.9},
  stationSelectorText: {color: colors.text, fontSize: 12, fontWeight: '700', flexShrink: 1},
  stationSelectorCaret: {color: colors.textMuted, fontSize: 10, marginLeft: spacing.xs},
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
  stopItemSelected: {
    backgroundColor: colors.accentMuted,
    borderBottomColor: colors.accent,
  },
  stopItemPressed: {opacity: 0.85},
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
  providerRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  providerChip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  providerChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  providerChipText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  providerChipTextActive: {color: colors.accent},
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
