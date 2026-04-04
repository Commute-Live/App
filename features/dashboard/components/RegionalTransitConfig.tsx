import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View} from 'react-native';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {colors, fonts, radii, spacing} from '../../../theme';
import {apiFetch} from '../../../lib/api';
import {extractConfigDisplayId} from '../../../lib/deviceConfig';
import {queryKeys} from '../../../lib/queryKeys';
import {configSharedStyles} from './configStyles';

const MAX_PHILLY_LINES = 2;
const DISPLAY_PRESETS = [1, 2, 3, 4, 5] as const;

type City = 'boston' | 'philadelphia' | 'new-jersey';
type Mode = 'train' | 'bus';
type StopOption = {stopId: string; stop: string};

type Props = {
  deviceId: string;
  city: City;
  mode: Mode;
};

const providerFor = (city: City, mode: Mode) => {
  if (city === 'boston') return 'mbta';
  if (city === 'new-jersey') return mode === 'bus' ? 'njt-bus' : 'njt-rail';
  return mode === 'bus' ? 'septa-bus' : 'septa-rail';
};

const stopsEndpointFor = (city: City, mode: Mode, route: string) => {
  if (city === 'boston') {
      return mode === 'bus'
      ? `/providers/boston/stops/bus?route=${encodeURIComponent(route)}&limit=1000`
      : `/providers/boston/stops/subway?route=${encodeURIComponent(route)}&limit=1000`;
  }
  if (city === 'new-jersey') {
    return `/njt/stations?mode=${mode === 'bus' ? 'bus' : 'rail'}`;
  }
  return mode === 'bus'
    ? '/providers/philly/stops/bus'
    : '/providers/philly/stops/train';
};

const linesForStopEndpointFor = (city: City, mode: Mode, stopId: string, direction?: 'N' | 'S') => {
  if (city === 'new-jersey') {
    const njtMode = mode === 'bus' ? 'bus' : 'rail';
    return `/njt/stations/${njtMode}/${encodeURIComponent(stopId)}/lines`;
  }
  if (city !== 'philadelphia') return '';
  if (mode === 'bus') {
    return `/providers/philly/stops/bus/${encodeURIComponent(stopId)}/lines`;
  }
  const params = new URLSearchParams();
  if (direction) params.set('direction', direction);
  const query = `?${params.toString()}`;
  return `/providers/philly/stops/train/${encodeURIComponent(stopId)}/lines${query}`;
};

const directionHint = (dir: 'N' | 'S') => (dir === 'N' ? 'Northbound (N)' : 'Southbound (S)');

const cityTitle = (city: City) => {
  if (city === 'boston') return 'Boston';
  if (city === 'new-jersey') return 'NJ Transit';
  return 'Philly';
};

export default function RegionalTransitConfig({deviceId, city, mode}: Props) {
  const queryClient = useQueryClient();
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
  const [activeDisplayId, setActiveDisplayId] = useState<string | null>(null);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const [phillyDirection, setPhillyDirection] = useState<'N' | 'S'>('N');
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
    setPhillyDirection('N');
    setSeptaDebugJson('');
  }, [city, mode]);

  useEffect(() => {
    let cancelled = false;
    if ((city !== 'philadelphia' && city !== 'new-jersey') || !stopId) return;

    const loadLines = async () => {
      setIsLoadingRoutes(true);
      try {
        const result = await queryClient.fetchQuery({
          queryKey: ['providers', city, mode, 'lines-for-stop', stopId, phillyDirection],
          queryFn: async () => {
            const response = await apiFetch(linesForStopEndpointFor(city, mode, stopId, phillyDirection));
            const data = await response.json().catch(() => null);
            return {ok: response.ok, data};
          },
        });
        if (!result.ok) {
          if (!cancelled) setLineOptions([]);
          return;
        }
        const data = result.data;
        const nextLines = Array.isArray(data?.lines)
          ? data.lines
              .map((line: unknown) => {
                if (typeof line === 'string') return line.toUpperCase();
                if (line && typeof line === 'object' && typeof (line as any).id === 'string') return (line as any).id.toUpperCase();
                return '';
              })
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
  }, [city, mode, phillyDirection, queryClient, stopId]);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      try {
        const result = await queryClient.fetchQuery({
          queryKey: queryKeys.deviceConfig(deviceId),
          queryFn: async () => {
            const response = await apiFetch(`/device/${deviceId}/config`);
            const data = await response.json().catch(() => null);
            return {ok: response.ok, data};
          },
        });
        if (!result.ok) return;
        const data = result.data;
        if (!cancelled) {
          setActiveDisplayId(extractConfigDisplayId(data));
        }
        const rows = Array.isArray(data?.config?.lines) ? data.config.lines : [];
        const matches = rows.filter((row: any) => typeof row?.provider === 'string' && row.provider === provider);
        if (matches.length === 0 || cancelled) return;

        const savedLines = matches
          .map((row: any) => (typeof row?.line === 'string' ? row.line.toUpperCase().trim() : ''))
          .filter((line: string) => line.length > 0);
        const savedStop = typeof matches[0]?.stop === 'string' ? matches[0].stop : '';
        const savedDirectionRaw = typeof matches[0]?.direction === 'string' ? matches[0].direction.toUpperCase() : '';
        if (savedLines.length > 0) {
          setRoute(savedLines[0]);
          setSelectedLines(savedLines.slice(0, MAX_PHILLY_LINES));
        }
        if (savedStop) {
          setStopId(savedStop);
          setStopName(savedStop);
        }
        if (city === 'philadelphia' && mode === 'train' && (savedDirectionRaw === 'N' || savedDirectionRaw === 'S')) {
          setPhillyDirection(savedDirectionRaw);
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
  }, [city, deviceId, mode, provider, queryClient]);

  useEffect(() => {
    let cancelled = false;
    if (!stopDropdownOpen) return;

    if (city !== 'philadelphia' && city !== 'new-jersey' && !route.trim()) {
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
        } else if (city === 'new-jersey') {
          const sep = endpoint.includes('?') ? '&' : '?';
          const params = new URLSearchParams();
          if (phillyStopQuery.trim().length > 0) {
            params.set('q', phillyStopQuery.trim());
          }
          params.set('limit', '500');
          endpoint = `${endpoint}${sep}${params.toString()}`;
        }

        const result = await queryClient.fetchQuery({
          queryKey: ['providers', city, mode, 'stops', route.trim() || 'none', phillyStopQuery.trim() || 'none'],
          queryFn: async () => {
            const response = await apiFetch(endpoint);
            const data = await response.json().catch(() => null);
            return {ok: response.ok, data};
          },
        });
        if (!result.ok) {
          if (!cancelled) setStops([]);
          return;
        }
        const data = result.data;
        const rawList = Array.isArray(data?.stations) ? data.stations : Array.isArray(data?.stops) ? data.stops : [];
        const options: StopOption[] = rawList
          .map((row: any) => ({
            stopId: typeof row?.stopId === 'string' ? row.stopId : typeof row?.id === 'string' ? row.id : '',
            stop: typeof row?.stop === 'string' ? row.stop : typeof row?.name === 'string' ? row.name : '',
          }))
          .filter((row: StopOption) => row.stopId.length > 0 && row.stop.length > 0);
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
  }, [city, mode, phillyStopQuery, queryClient, route, stopDropdownOpen, stopId]);

  const chooseStop = useCallback((option: StopOption) => {
    setStopId(option.stopId);
    setStopName(option.stop);
    setStopDropdownOpen(false);
    setStatusText('');
  }, []);

  const saveConfigMutation = useMutation({
    mutationFn: async (payload: {
      nextDeviceId: string;
      nextDisplayId: string | null;
      nextDisplayType: number;
      payloadLines: Array<{provider: string; line: string; stop: string; direction?: 'N' | 'S'}>;
    }) => {
      const response = await apiFetch(`/device/${payload.nextDeviceId}/config`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          displayId: payload.nextDisplayId ?? undefined,
          displayType: payload.nextDisplayType,
          lines: payload.payloadLines,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ok: false as const,
          status: response.status,
          data,
        };
      }
      await apiFetch(`/refresh/device/${payload.nextDeviceId}`, {method: 'POST'});
      return {
        ok: true as const,
        data,
      };
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({queryKey: queryKeys.deviceConfig(variables.nextDeviceId)});
      void queryClient.invalidateQueries({queryKey: queryKeys.displays(variables.nextDeviceId)});
    },
  });

  const septaDebugMutation = useMutation({
    mutationFn: async ({stationValue, direction}: {stationValue: string; direction: 'N' | 'S'}) => {
      const endpoint = `/providers/philly/debug/arrivals?station=${encodeURIComponent(stationValue)}&direction=${direction}&results=30`;
      const response = await apiFetch(endpoint);
      const data = await response.json().catch(() => null);
      return {ok: response.ok, status: response.status, data};
    },
  });

  const saveConfig = useCallback(async () => {
    if (!deviceId) return;
    const routeTrimmed = route.trim();
    const linesToSave = (city === 'philadelphia' || city === 'new-jersey')
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
      const result = await saveConfigMutation.mutateAsync({
        nextDeviceId: deviceId,
        nextDisplayId: activeDisplayId,
        nextDisplayType: displayType,
        payloadLines: linesToSave.map(line => ({
          provider,
          line,
          stop: stopTrimmed,
          ...(city === 'philadelphia' && mode === 'train' ? {direction: phillyDirection} : {}),
        })),
      });

      if (!result.ok) {
        const message =
          typeof result.data?.error === 'string'
            ? result.data.error
            : `Failed to save line (${result.status})`;
        setStatusText(message);
        return;
      }

      setActiveDisplayId(extractConfigDisplayId(result.data));
      setStatusText(`Updated ${linesToSave.join(', ')} @ ${stopName} (${stopTrimmed})`);
    } catch {
      setStatusText('Network error');
    } finally {
      setIsSaving(false);
    }
  }, [
    activeDisplayId,
    city,
    deviceId,
    displayType,
    mode,
    phillyDirection,
    provider,
    route,
    saveConfigMutation,
    selectedLines,
    stopId,
    stopName,
  ]);

  const loadSeptaDebugJson = useCallback(async () => {
    if (city !== 'philadelphia' || mode !== 'train') return;
    const stationValue = stopName.trim() || stopId.trim();
    if (!stationValue) {
      setSeptaDebugJson('Select a SEPTA rail station first.');
      return;
    }

    setSeptaDebugLoading(true);
    try {
      const result = await septaDebugMutation.mutateAsync({stationValue, direction: phillyDirection});
      if (!result.ok) {
        const message = typeof result.data?.error === 'string' ? result.data.error : `Debug fetch failed (${result.status})`;
        setSeptaDebugJson(JSON.stringify({error: message, details: result.data ?? null}, null, 2));
        return;
      }
      setSeptaDebugJson(JSON.stringify(result.data, null, 2));
    } catch {
      setSeptaDebugJson(JSON.stringify({error: 'Network error while loading SEPTA debug JSON'}, null, 2));
    } finally {
      setSeptaDebugLoading(false);
    }
  }, [city, mode, phillyDirection, septaDebugMutation, stopId, stopName]);

  const shareSeptaDebugJson = useCallback(async () => {
    if (!septaDebugJson) return;
    try {
      await Share.share({
        message: septaDebugJson,
      });
    } catch {
      setStatusText('Unable to open share sheet');
    }
  }, [septaDebugJson]);

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
        {(city === 'philadelphia' || city === 'new-jersey') ? (
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

        {city === 'philadelphia' && mode === 'train' && (
          <>
            <Text style={styles.hintText}>Direction</Text>
            <View style={styles.lineGrid}>
              {(['N', 'S'] as const).map(dir => {
                const isSelected = phillyDirection === dir;
                return (
                  <Pressable
                    key={dir}
                    style={[styles.lineChip, isSelected && styles.lineChipActive]}
                    onPress={() => setPhillyDirection(dir)}>
                    <Text style={[styles.lineChipText, isSelected && styles.lineChipTextActive]}>
                      {directionHint(dir)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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

        {(city === 'philadelphia' || city === 'new-jersey') && (
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
                  No {(city === 'philadelphia' || city === 'new-jersey') ? (mode === 'train' ? 'stations' : 'stops') : 'stops'} available
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

        {(city === 'philadelphia' || city === 'new-jersey') && (
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
                    <Pressable style={styles.debugShareButton} onPress={shareSeptaDebugJson}>
                      <Text style={styles.debugShareButtonText}>Share / Copy JSON</Text>
                    </Pressable>
                    <Text style={styles.hintText}>Tip: long-press inside JSON to select and copy text.</Text>
                    <ScrollView style={styles.debugScroll} nestedScrollEnabled>
                      <Text style={styles.debugText} selectable>
                        {septaDebugJson}
                      </Text>
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
  ...configSharedStyles,
  input: {
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  saveButtonDisabled: {opacity: 0.6},
  lineGrid: {
    ...configSharedStyles.lineGrid,
    marginBottom: spacing.sm,
  },
  debugBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
  },
  debugShareButton: {
    margin: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.accentMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  debugShareButtonText: {color: colors.accent, fontSize: 11, fontWeight: '800'},
  debugScroll: {maxHeight: 220},
  debugText: {
    color: colors.text,
    fontSize: 10,
    padding: spacing.sm,
    fontFamily: fonts.sans,
  },
});
