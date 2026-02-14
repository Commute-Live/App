import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {colors, radii, spacing} from '../../../theme';

const API_BASE = 'https://api.commutelive.com';
const DEFAULT_STOP_ID = '725N';
const DEFAULT_STOP_NAME = 'Times Sq-42 St';
const MAX_SELECTED_LINES = 2;
const MAX_SELECTED_BUS_LINES = 1;

type StopOption = {stopId: string; stop: string; direction: 'N' | 'S' | ''};
type BusRouteOption = {id: string; label: string};

type Props = {
  deviceId: string;
  providerId?: 'mta-subway' | 'mta-bus';
};

export default function NycSubwayConfig({deviceId, providerId = 'mta-subway'}: Props) {
  const isBusMode = providerId === 'mta-bus';
  const [selectedLines, setSelectedLines] = useState<string[]>(['E', 'A']);
  const [stopId, setStopId] = useState(DEFAULT_STOP_ID);
  const [stopName, setStopName] = useState(DEFAULT_STOP_NAME);
  const [busRouteOptions, setBusRouteOptions] = useState<BusRouteOption[]>([]);
  const [busRouteDropdownOpen, setBusRouteDropdownOpen] = useState(false);
  const [isLoadingBusRoutes, setIsLoadingBusRoutes] = useState(false);
  const [allStops, setAllStops] = useState<StopOption[]>([]);
  const [stopOptions, setStopOptions] = useState<StopOption[]>([]);
  const [stopDropdownOpen, setStopDropdownOpen] = useState(false);
  const [isLoadingStops, setIsLoadingStops] = useState(false);
  const [stopsError, setStopsError] = useState('');
  const [availableLines, setAvailableLines] = useState<string[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [stopError, setStopError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_BASE}/device/${deviceId}/config`);
        if (!response.ok) return;
        const data = await response.json();
        const firstProvider = typeof data?.config?.lines?.[0]?.provider === 'string' ? data.config.lines[0].provider : '';
        if (isBusMode) {
          if (firstProvider !== 'mta-bus') return;
        } else if (firstProvider !== 'mta-subway' && firstProvider !== 'mta') {
          return;
        }

        const configuredLines = Array.isArray(data?.config?.lines)
          ? data.config.lines
              .map((line: any) => (typeof line?.line === 'string' ? line.line.toUpperCase() : ''))
              .filter((line: string) => line.length > 0)
          : [];
        const firstStopId = typeof data?.config?.lines?.[0]?.stop === 'string' ? data.config.lines[0].stop : '';
        const firstDirection =
          typeof data?.config?.lines?.[0]?.direction === 'string' ? data.config.lines[0].direction.toUpperCase() : '';

        if (!cancelled && configuredLines.length > 0) {
          const maxLines = isBusMode ? MAX_SELECTED_BUS_LINES : MAX_SELECTED_LINES;
          const picked = configuredLines.slice(0, maxLines);
          setSelectedLines(picked);
        }
        if (!cancelled && firstStopId.length > 0) {
          const normalized = firstStopId.toUpperCase();
          if (normalized.endsWith('N') || normalized.endsWith('S')) {
            setStopId(normalized);
          } else if (firstDirection === 'N' || firstDirection === 'S') {
            setStopId(`${normalized}${firstDirection}`);
          } else {
            setStopId(normalized);
          }
        }
      } catch {
        // Keep defaults.
      }
    };

    if (deviceId) {
      void loadConfig();
    }

    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  useEffect(() => {
    setAllStops([]);
    setStopOptions([]);
    setStopDropdownOpen(false);
    setBusRouteDropdownOpen(false);
    setStatusText('');
    setStopError('');
    setStopsError('');
    if (isBusMode) {
      setSelectedLines(prev => {
        return prev.length > 0 ? [prev[0]] : ['M15'];
      });
      setStopId('404040');
      setStopName('Select bus stop');
    } else {
      setSelectedLines(prev => (prev.length > 0 ? prev.slice(0, MAX_SELECTED_LINES) : ['E', 'A']));
      setStopId(DEFAULT_STOP_ID);
      setStopName(DEFAULT_STOP_NAME);
    }
  }, [isBusMode]);

  useEffect(() => {
    let cancelled = false;
    if (!isBusMode) return;

    const run = async () => {
      setIsLoadingBusRoutes(true);
      try {
        const response = await fetch(`${API_BASE}/providers/new-york/routes/bus?limit=1000`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          const routes = Array.isArray(data?.routes) ? (data.routes as BusRouteOption[]) : [];
          setBusRouteOptions(routes);
          setSelectedLines(prev => {
            const current = (prev[0] ?? '').trim().toUpperCase();
            if (current.length > 0 && routes.some(route => route.id.toUpperCase() === current)) {
              return [current];
            }
            if (routes.length > 0) {
              return [routes[0].id.toUpperCase()];
            }
            return prev;
          });
        }
      } catch {
        if (!cancelled) setBusRouteOptions([]);
      } finally {
        if (!cancelled) setIsLoadingBusRoutes(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [isBusMode]);

  useEffect(() => {
    let cancelled = false;
    if (!stopDropdownOpen) return;

    const run = async () => {
      const primaryRoute = selectedLines[0]?.trim().toUpperCase();
      if (isBusMode && !primaryRoute) {
        if (!cancelled) {
          setAllStops([]);
          setStopsError('Select a bus route first');
        }
        return;
      }
      setIsLoadingStops(true);
      setStopsError('');
      try {
        const response = isBusMode
          ? await fetch(
              `${API_BASE}/providers/new-york/stops/bus?route=${encodeURIComponent(primaryRoute)}&limit=1000`,
            )
          : await fetch(`${API_BASE}/stops?limit=1000`);
        console.log('[NYC stops] request', {
          mode: isBusMode ? 'bus' : 'subway',
          route: primaryRoute ?? null,
          status: response.status,
          ok: response.ok,
        });
        if (!response.ok) {
          if (!cancelled) setStopsError('Failed to load stops');
          return;
        }
        const data = await response.json();
        console.log('[NYC stops] response', {
          mode: isBusMode ? 'bus' : 'subway',
          route: primaryRoute ?? null,
          count: Array.isArray(data?.stops) ? data.stops.length : -1,
          sample: Array.isArray(data?.stops) ? data.stops.slice(0, 2) : data,
        });
        if (!cancelled) {
          const options = Array.isArray(data?.stops) ? (data.stops as StopOption[]) : [];
          setAllStops(options);
          if (options.length === 0) setStopsError('No stops found');
        }
      } catch {
        console.log('[NYC stops] error', {
          mode: isBusMode ? 'bus' : 'subway',
          route: primaryRoute ?? null,
        });
        if (!cancelled) {
          setAllStops([]);
          setStopsError('Failed to load stops');
        }
      } finally {
        if (!cancelled) setIsLoadingStops(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [stopDropdownOpen, selectedLines, isBusMode]);

  useEffect(() => {
    if (!stopDropdownOpen) {
      setStopOptions([]);
      return;
    }
    setStopOptions(allStops);
  }, [allStops, stopDropdownOpen]);

  useEffect(() => {
    if (isBusMode) {
      const normalizedLine = (selectedLines[0] ?? '').trim().toUpperCase();
      if (!normalizedLine.length) {
        setAvailableLines([]);
        setSelectedLines([]);
        return;
      }
      setAvailableLines([normalizedLine]);
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
      setAvailableLines([]);
      try {
        const response = await fetch(`${API_BASE}/stops/${encodeURIComponent(normalizedStopId)}/lines`);
        console.log('[NYC lines] request', {stopId: normalizedStopId, status: response.status, ok: response.ok});
        if (!response.ok) {
          if (!cancelled) {
            setAvailableLines([]);
            setSelectedLines([]);
          }
          return;
        }

        const data = await response.json();
        console.log('[NYC lines] response', {
          stopId: normalizedStopId,
          lines: Array.isArray(data?.lines) ? data.lines : data,
        });
        const lines = Array.isArray(data?.lines)
          ? data.lines
              .map((line: unknown) => (typeof line === 'string' ? line.toUpperCase() : ''))
              .filter((line: string) => line.length > 0)
          : [];

        if (!cancelled) {
          setAvailableLines(lines);
          setSelectedLines(prev => {
            const filtered = prev.filter(line => lines.includes(line));
            const next = (filtered.length > 0 ? filtered : lines).slice(0, MAX_SELECTED_LINES);
            if (next.length === prev.length && next.every((line: string, idx: number) => line === prev[idx])) {
              return prev;
            }
            return next;
          });
        }
      } catch {
        console.log('[NYC lines] error', {stopId: normalizedStopId});
        if (!cancelled) {
          setAvailableLines([]);
          setSelectedLines([]);
        }
      } finally {
        if (!cancelled) setIsLoadingLines(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [stopId, isBusMode]);

  const chooseStop = useCallback((option: StopOption) => {
    setStopId(option.stopId.toUpperCase());
    setStopName(option.stop);
    setStopOptions([]);
    setStopDropdownOpen(false);
    setStopError('');
    setStatusText('');
  }, []);

  const chooseBusRoute = useCallback((option: BusRouteOption) => {
    const route = option.id.trim().toUpperCase();
    setSelectedLines(route ? [route] : []);
    setBusRouteDropdownOpen(false);
    setAllStops([]);
    setStopOptions([]);
    setStopId('');
    setStopName('Select bus stop');
    setStopError('');
    setStatusText('');
  }, []);

  const toggleLine = useCallback((line: string) => {
    if (isBusMode) {
      setSelectedLines([line]);
      return;
    }
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
  }, [isBusMode]);

  const derivedDirection: 'N' | 'S' = stopId.toUpperCase().endsWith('S') ? 'S' : 'N';

  const saveConfig = useCallback(async () => {
    if (!deviceId) return;
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
      const configResponse = await fetch(`${API_BASE}/device/${deviceId}/config`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          lines: selectedLines.map(line => ({
            provider: isBusMode ? 'mta-bus' : 'mta-subway',
            line,
            stop: normalizedStopId,
            ...(isBusMode ? {} : {direction: derivedDirection}),
          })),
        }),
      });

      if (!configResponse.ok) {
        setStatusText('Failed to save line');
        return;
      }

      await fetch(`${API_BASE}/refresh/device/${deviceId}`, {method: 'POST'});
      if (isBusMode) {
        setStatusText(`Updated ${selectedLines.join(', ')} at ${normalizedStopId}`);
      } else {
        setStatusText(`Updated ${selectedLines.join(', ')} at ${normalizedStopId} ${derivedDirection}`);
      }
    } catch {
      setStatusText('Network error');
    } finally {
      setIsSaving(false);
    }
  }, [deviceId, selectedLines, stopId, derivedDirection, isBusMode]);

  const lineButtons = useMemo(
    () =>
      availableLines.map(line => (
        <Pressable
          key={line}
          style={[styles.lineChip, selectedLines.includes(line) && styles.lineChipActive]}
          onPress={() => toggleLine(line)}
          disabled={isSaving || isLoadingLines}>
          <Text style={[styles.lineChipText, selectedLines.includes(line) && styles.lineChipTextActive]}>{line}</Text>
        </Pressable>
      )),
    [availableLines, selectedLines, toggleLine, isSaving, isLoadingLines],
  );

  const selectedBusRoute = selectedLines[0]?.trim().toUpperCase() ?? '';
  const selectedBusRouteLabel = useMemo(() => {
    if (!selectedBusRoute) return 'Select bus route';
    const match = busRouteOptions.find(option => option.id.toUpperCase() === selectedBusRoute);
    return match?.label ?? selectedBusRoute;
  }, [busRouteOptions, selectedBusRoute]);

  return (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>NYC Station</Text>
        {isBusMode && (
          <>
            <Text style={styles.hintText}>Bus route</Text>
            <Pressable
              style={({pressed}) => [
                styles.stationSelector,
                busRouteDropdownOpen && styles.stationSelectorOpen,
                pressed && styles.stationSelectorPressed,
              ]}
              onPress={() => setBusRouteDropdownOpen(prev => !prev)}>
              <Text style={styles.stationSelectorText}>{selectedBusRouteLabel}</Text>
              <Text style={styles.stationSelectorCaret}>{busRouteDropdownOpen ? '▲' : '▼'}</Text>
            </Pressable>
            {isLoadingBusRoutes && <Text style={styles.hintText}>Loading NYC bus routes...</Text>}
            {busRouteDropdownOpen && !isLoadingBusRoutes && busRouteOptions.length > 0 && (
              <View style={styles.stopList}>
                <ScrollView style={styles.stopListScroll} nestedScrollEnabled>
                  {busRouteOptions.map(option => {
                    const isSelected = option.id.toUpperCase() === selectedBusRoute;
                    return (
                      <Pressable
                        key={option.id}
                        style={({pressed}) => [
                          styles.stopItem,
                          isSelected && styles.stopItemSelected,
                          pressed && styles.stopItemPressed,
                        ]}
                        onPress={() => chooseBusRoute(option)}>
                        <Text style={styles.stopItemTitle}>{option.id}</Text>
                        <Text style={styles.stopItemSubtitle}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </>
        )}

        <Pressable
          style={({pressed}) => [
            styles.stationSelector,
            stopDropdownOpen && styles.stationSelectorOpen,
            pressed && styles.stationSelectorPressed,
          ]}
          onPress={() => {
            setStopDropdownOpen(prev => !prev);
            setStopError('');
            setStopsError('');
          }}>
          <Text style={styles.stationSelectorText}>
            {stopName} ({stopId})
          </Text>
          <Text style={styles.stationSelectorCaret}>{stopDropdownOpen ? '▲' : '▼'}</Text>
        </Pressable>

        {isLoadingStops && <Text style={styles.hintText}>Searching NYC {isBusMode ? 'bus' : 'subway'} stops...</Text>}
        {stopDropdownOpen && (
          <View style={styles.stopList}>
            <ScrollView style={styles.stopListScroll} nestedScrollEnabled>
              {!isLoadingStops && stopOptions.length === 0 && (
                <Text style={styles.stopItemSubtitle}>{stopsError || 'No stops available'}</Text>
              )}
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
        <Text style={styles.sectionTitle}>{isBusMode ? 'NYC Bus' : 'NYC Trains'}</Text>
        <Text style={styles.hintText}>
          {isBusMode ? `Selected route for ${stopId}.` : `Select up to 2 lines for ${stopId}.`}
        </Text>
        <Text style={styles.destFixed}>Selected: {selectedLines.join(', ') || 'None'}</Text>

        {isLoadingLines && <Text style={styles.hintText}>Loading lines...</Text>}
        {!isLoadingLines && availableLines.length === 0 && (
          <Text style={styles.hintText}>No lines found for this stop yet.</Text>
        )}
        {!isBusMode && <View style={styles.lineGrid}>{lineButtons}</View>}

        <Pressable
          style={styles.saveButton}
          onPress={saveConfig}
          disabled={isSaving || isLoadingLines || isLoadingStops || (isBusMode && isLoadingBusRoutes)}>
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
