import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {colors, radii, spacing} from '../../../theme';
import {apiFetch} from '../../../lib/api';

const MAX_PHILLY_LINES = 2;
const DISPLAY_PRESETS = [1, 2, 3, 4, 5] as const;

type City = 'boston' | 'philadelphia';
type Mode = 'train' | 'bus';
type StopOption = {stopId: string; stop: string};

type Props = {
  deviceId: string;
  city: City;
  mode: Mode;
};

const providerFor = (city: City, mode: Mode) => {
  if (city === 'boston') return 'mbta';
  return mode === 'bus' ? 'septa-bus' : 'septa-rail';
};

const stopsEndpointFor = (city: City, mode: Mode, route: string) => {
  if (city === 'boston') {
      return mode === 'bus'
      ? `/providers/boston/stops/bus?route=${encodeURIComponent(route)}&limit=1000`
      : `/providers/boston/stops/subway?route=${encodeURIComponent(route)}&limit=1000`;
  }
  return mode === 'bus'
    ? '/providers/philly/stops/bus'
    : '/providers/philly/stops/train';
};

const linesForStopEndpointFor = (city: City, mode: Mode, stopId: string) => {
  if (city !== 'philadelphia') return '';
  return mode === 'bus'
    ? `/providers/philly/stops/bus/${encodeURIComponent(stopId)}/lines`
    : `/providers/philly/stops/train/${encodeURIComponent(stopId)}/lines`;
};

const cityTitle = (city: City) => (city === 'boston' ? 'Boston' : 'Philly');

export default function RegionalTransitConfig({deviceId, city, mode}: Props) {
  const [route, setRoute] = useState('');
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [lineOptions, setLineOptions] = useState<string[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [stops, setStops] = useState<StopOption[]>([]);
  const [phillyStopQuery, setPhillyStopQuery] = useState('');
  const [stopId, setStopId] = useState('');
  const [stopName, setStopName] = useState('Select stop');
  const [stopDropdownOpen, setStopDropdownOpen] = useState(false);
  const [isLoadingStops, setIsLoadingStops] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [displayType, setDisplayType] = useState<number>(1);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const [septaDebugJson, setSeptaDebugJson] = useState('');
  const [septaDebugLoading, setSeptaDebugLoading] = useState(false);

  const provider = useMemo(() => providerFor(city, mode), [city, mode]);

  useEffect(() => {
    setRoute('');
    setSelectedLines([]);
    setLineOptions([]);
    setStops([]);
    setPhillyStopQuery('');
    setStopId('');
    setStopName('Select stop');
    setStatusText('');
    setStopDropdownOpen(false);
    setSeptaDebugJson('');
  }, [city, mode]);

  useEffect(() => {
    let cancelled = false;
    if (city !== 'philadelphia' || !stopId) return;

    const loadLines = async () => {
      setIsLoadingRoutes(true);
      try {
        const response = await apiFetch(linesForStopEndpointFor(city, mode, stopId));
        if (!response.ok) {
          if (!cancelled) setLineOptions([]);
          return;
        }
        const data = await response.json();
        const nextLines = Array.isArray(data?.lines)
          ? data.lines
              .map((line: unknown) => (typeof line === 'string' ? line.toUpperCase() : ''))
              .filter((line: string) => line.length > 0)
          : [];
        if (!cancelled) {
          setLineOptions(nextLines);
          setSelectedLines(prev => {
            const filtered = prev.filter(line => nextLines.includes(line));
            if (filtered.length > 0) return filtered.slice(0, MAX_PHILLY_LINES);
            return nextLines.slice(0, MAX_PHILLY_LINES);
          });
        }
      } catch {
        if (!cancelled) setLineOptions([]);
      } finally {
        if (!cancelled) setIsLoadingRoutes(false);
      }
    };

    void loadLines();

    return () => {
      cancelled = true;
    };
  }, [city, mode, stopId]);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      try {
        const response = await apiFetch(`/device/${deviceId}/config`);
        if (!response.ok) return;
        const data = await response.json();
        const rows = Array.isArray(data?.config?.lines) ? data.config.lines : [];
        const matches = rows.filter((row: any) => typeof row?.provider === 'string' && row.provider === provider);
        if (matches.length === 0 || cancelled) return;

        const savedLines = matches
          .map((row: any) => (typeof row?.line === 'string' ? row.line.toUpperCase().trim() : ''))
          .filter((line: string) => line.length > 0);
        const savedStop = typeof matches[0]?.stop === 'string' ? matches[0].stop : '';
        if (savedLines.length > 0) {
          setRoute(savedLines[0]);
          setSelectedLines(savedLines.slice(0, MAX_PHILLY_LINES));
        }
        if (savedStop) {
          setStopId(savedStop);
          setStopName(savedStop);
        }
        const configuredDisplayType = Number(data?.config?.displayType);
        if (Number.isFinite(configuredDisplayType)) {
          const normalizedPreset = Math.max(1, Math.min(5, Math.trunc(configuredDisplayType)));
          setDisplayType(normalizedPreset);
        }
      } catch {
        // no-op
      }
    };

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, [deviceId, provider]);

  useEffect(() => {
    let cancelled = false;
    if (!stopDropdownOpen) return;

    if (city !== 'philadelphia' && !route.trim()) {
      setStops([]);
      return;
    }

    const loadStops = async () => {
      setIsLoadingStops(true);
      try {
        let endpoint = stopsEndpointFor(city, mode, route.trim());
        if (city === 'philadelphia') {
          const params = new URLSearchParams();
          if (phillyStopQuery.trim().length > 0) {
            params.set('q', phillyStopQuery.trim());
          }
          params.set('limit', '1000');
          endpoint = `${endpoint}?${params.toString()}`;
        }

        const response = await apiFetch(endpoint);
        if (!response.ok) {
          if (!cancelled) setStops([]);
          return;
        }
        const data = await response.json();
        const options: StopOption[] = Array.isArray(data?.stops)
          ? data.stops
              .map((row: any) => ({
                stopId: typeof row?.stopId === 'string' ? row.stopId : typeof row?.id === 'string' ? row.id : '',
                stop: typeof row?.stop === 'string' ? row.stop : typeof row?.name === 'string' ? row.name : '',
              }))
              .filter((row: StopOption) => row.stopId.length > 0 && row.stop.length > 0)
          : [];
        if (!cancelled) {
          setStops(options);
          const selected = options.find(s => s.stopId === stopId);
          if (selected) setStopName(selected.stop);
        }
      } catch {
        if (!cancelled) setStops([]);
      } finally {
        if (!cancelled) setIsLoadingStops(false);
      }
    };

    void loadStops();

    return () => {
      cancelled = true;
    };
  }, [city, mode, route, stopDropdownOpen, stopId, phillyStopQuery]);

  const chooseStop = useCallback((option: StopOption) => {
    setStopId(option.stopId);
    setStopName(option.stop);
    setStopDropdownOpen(false);
    setStatusText('');
  }, []);

  const saveConfig = useCallback(async () => {
    if (!deviceId) return;
    const routeTrimmed = route.trim();
    const linesToSave = city === 'philadelphia'
      ? selectedLines.map(line => line.trim()).filter(line => line.length > 0).slice(0, MAX_PHILLY_LINES)
      : (routeTrimmed ? [routeTrimmed] : []);
    const stopTrimmed = stopId.trim();
    if (linesToSave.length === 0 || !stopTrimmed) {
      setStatusText('Pick line and stop');
      return;
    }

    setIsSaving(true);
    setStatusText('');
    try {
      const response = await apiFetch(`/device/${deviceId}/config`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          displayType,
          lines: linesToSave.map(line => ({
              provider,
              line,
              stop: stopTrimmed,
            })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message =
          typeof data?.error === 'string'
            ? data.error
            : `Failed to save line (${response.status})`;
        setStatusText(message);
        return;
      }

      await apiFetch(`/refresh/device/${deviceId}`, {method: 'POST'});
      setStatusText(`Updated ${linesToSave.join(', ')} @ ${stopName} (${stopTrimmed})`);
    } catch {
      setStatusText('Network error');
    } finally {
      setIsSaving(false);
    }
  }, [city, deviceId, provider, route, selectedLines, stopId, stopName, displayType]);

  const loadSeptaDebugJson = useCallback(async () => {
    if (city !== 'philadelphia' || mode !== 'train') return;
    const stationValue = stopName.trim() || stopId.trim();
    if (!stationValue) {
      setSeptaDebugJson('Select a SEPTA rail station first.');
      return;
    }

    setSeptaDebugLoading(true);
    try {
      const endpoint = `/providers/philly/debug/arrivals?station=${encodeURIComponent(stationValue)}&results=30`;
      const response = await apiFetch(endpoint);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : `Debug fetch failed (${response.status})`;
        setSeptaDebugJson(JSON.stringify({error: message, details: data ?? null}, null, 2));
        return;
      }
      setSeptaDebugJson(JSON.stringify(data, null, 2));
    } catch {
      setSeptaDebugJson(JSON.stringify({error: 'Network error while loading SEPTA debug JSON'}, null, 2));
    } finally {
      setSeptaDebugLoading(false);
    }
  }, [city, mode, stopId, stopName]);

  return (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Preset Layout</Text>
        <Text style={styles.hintText}>Choose layout preset for this device (1-5).</Text>
        <Pressable
          style={({pressed}) => [
            styles.stationSelector,
            presetDropdownOpen && styles.stationSelectorOpen,
            pressed && styles.stationSelectorPressed,
          ]}
          onPress={() => setPresetDropdownOpen(prev => !prev)}>
          <Text style={styles.stationSelectorText}>Preset {displayType}</Text>
          <Text style={styles.stationSelectorCaret}>{presetDropdownOpen ? '▲' : '▼'}</Text>
        </Pressable>

        {presetDropdownOpen && (
          <View style={styles.stopList}>
            <ScrollView style={styles.stopListScroll} nestedScrollEnabled>
              {DISPLAY_PRESETS.map(option => {
                const isSelected = displayType === option;
                return (
                  <Pressable
                    key={option}
                    style={({pressed}) => [
                      styles.stopItem,
                      isSelected && styles.stopItemSelected,
                      pressed && styles.stopItemPressed,
                    ]}
                    onPress={() => {
                      setDisplayType(option);
                      setPresetDropdownOpen(false);
                    }}>
                    <Text style={styles.stopItemTitle}>Preset {option}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{cityTitle(city)} {mode === 'train' ? 'Train' : 'Bus'}</Text>
        {city === 'philadelphia' ? (
          <Text style={styles.hintText}>
            Pick {mode === 'train' ? 'rail station' : 'bus stop'} first, then choose up to 2 lines.
          </Text>
        ) : (
          <>
            <Text style={styles.hintText}>
              Enter route/line first (example: {mode === 'train' ? 'Red' : '1'})
            </Text>
            <TextInput
              value={route}
              onChangeText={setRoute}
              placeholder="Route / Line"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="characters"
            />
          </>
        )}

        <Pressable
          style={({pressed}) => [
            styles.stationSelector,
            stopDropdownOpen && styles.stationSelectorOpen,
            pressed && styles.stationSelectorPressed,
          ]}
          onPress={() => setStopDropdownOpen(prev => !prev)}>
          <Text style={styles.stationSelectorText}>{stopName} ({stopId || '-'})</Text>
          <Text style={styles.stationSelectorCaret}>{stopDropdownOpen ? '▲' : '▼'}</Text>
        </Pressable>

        {city === 'philadelphia' && (
          <TextInput
            value={phillyStopQuery}
            onChangeText={setPhillyStopQuery}
            placeholder={mode === 'train' ? 'Search rail stations' : 'Search bus stops'}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="words"
          />
        )}

        {isLoadingStops && <Text style={styles.hintText}>Loading stops...</Text>}

        {stopDropdownOpen && (
          <View style={styles.stopList}>
            <ScrollView style={styles.stopListScroll} nestedScrollEnabled>
              {!isLoadingStops && stops.length === 0 && (
                <Text style={styles.emptyText}>
                  No {city === 'philadelphia' ? (mode === 'train' ? 'stations' : 'stops') : 'stops'} available
                </Text>
              )}
              {stops.map(option => {
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
                    <Text style={styles.stopItemSubtitle}>{option.stopId}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {city === 'philadelphia' && (
          <>
            {isLoadingRoutes && <Text style={styles.hintText}>Loading lines...</Text>}
            {!isLoadingRoutes && lineOptions.length === 0 && <Text style={styles.hintText}>No lines for this stop</Text>}
            {!!selectedLines.length && <Text style={styles.hintText}>Selected: {selectedLines.join(', ')}</Text>}
            <View style={styles.lineGrid}>
              {lineOptions.map(line => {
                const isSelected = selectedLines.includes(line);
                return (
                  <Pressable
                    key={line}
                    style={[styles.lineChip, isSelected && styles.lineChipActive]}
                    onPress={() => {
                      setSelectedLines(prev => {
                        if (prev.includes(line)) {
                          return prev.filter(item => item !== line);
                        }
                        if (prev.length >= MAX_PHILLY_LINES) {
                          return [...prev.slice(1), line];
                        }
                        return [...prev, line];
                      });
                      setStatusText('');
                    }}>
                    <Text style={[styles.lineChipText, isSelected && styles.lineChipTextActive]}>{line}</Text>
                  </Pressable>
                );
              })}
            </View>

            {mode === 'train' && (
              <>
                <Pressable
                  style={[styles.saveButton, septaDebugLoading && styles.saveButtonDisabled]}
                  onPress={loadSeptaDebugJson}
                  disabled={septaDebugLoading}>
                  <Text style={styles.saveButtonText}>{septaDebugLoading ? 'Loading API JSON...' : 'Show SEPTA API JSON'}</Text>
                </Pressable>
                {!!septaDebugJson && (
                  <View style={styles.debugBox}>
                    <ScrollView style={styles.debugScroll} nestedScrollEnabled>
                      <Text style={styles.debugText}>{septaDebugJson}</Text>
                    </ScrollView>
                  </View>
                )}
              </>
            )}
          </>
        )}

        <Pressable style={styles.saveButton} onPress={saveConfig} disabled={isSaving || isLoadingStops}>
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save to Device'}</Text>
        </Pressable>

        {!!statusText && <Text style={styles.statusNote}>{statusText}</Text>}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.sm},
  hintText: {color: colors.textMuted, fontSize: 11, marginBottom: spacing.xs},
  input: {
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
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
  emptyText: {color: colors.textMuted, fontSize: 12, padding: spacing.sm},
  saveButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  saveButtonDisabled: {opacity: 0.6},
  saveButtonText: {color: colors.background, fontSize: 12, fontWeight: '800'},
  statusNote: {color: colors.textMuted, fontSize: 11, marginTop: spacing.sm},
  lineGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm},
  debugBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
  },
  debugScroll: {maxHeight: 220},
  debugText: {
    color: colors.text,
    fontSize: 10,
    padding: spacing.sm,
    fontFamily: 'Courier',
  },
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
});
