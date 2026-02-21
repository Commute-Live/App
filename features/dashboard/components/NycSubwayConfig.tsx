import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {colors, radii, spacing} from '../../../theme';
import {apiFetch} from '../../../lib/api';

const DEFAULT_STOP_ID = '725N';
const DEFAULT_STOP_NAME = 'Times Sq-42 St';
const MAX_SELECTED_LINES = 2;
const MAX_SELECTED_BUS_LINES = 1;
const DISPLAY_PRESETS = [1, 2, 3, 4, 5] as const;

type StopOption = {stopId: string; stop: string; direction: 'N' | 'S' | ''};
type BusRouteOption = {id: string; label: string};
type SubwaySelection = {line: string; stopId: string; stopName: string};

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
  const [displayType, setDisplayType] = useState<number>(1);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const [subwaySelections, setSubwaySelections] = useState<SubwaySelection[]>([
    {line: 'E', stopId: DEFAULT_STOP_ID, stopName: DEFAULT_STOP_NAME},
  ]);
  const [activeSubwaySelectionIndex, setActiveSubwaySelectionIndex] = useState<0 | 1>(0);
  const [subwayStopDropdownOpen, setSubwayStopDropdownOpen] = useState(false);
  const [subwayAllStops, setSubwayAllStops] = useState<StopOption[]>([]);
  const [subwayAvailableLines, setSubwayAvailableLines] = useState<string[][]>([[], []]);
  const [subwayLoadingLines, setSubwayLoadingLines] = useState<boolean[]>([false, false]);

  const normalizeStopId = useCallback((rawStop: string, rawDirection: string) => {
    const normalized = rawStop.trim().toUpperCase();
    if (!normalized.length) return '';
    if (normalized.endsWith('N') || normalized.endsWith('S')) return normalized;
    const direction = rawDirection.trim().toUpperCase();
    if (direction === 'N' || direction === 'S') return `${normalized}${direction}`;
    return normalized;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const response = await apiFetch(`/device/${deviceId}/config`);
        if (!response.ok) return;
        const data = await response.json();
        const firstProvider = typeof data?.config?.lines?.[0]?.provider === 'string' ? data.config.lines[0].provider : '';
        if (isBusMode) {
          if (firstProvider !== 'mta-bus') return;
        } else if (firstProvider !== 'mta-subway' && firstProvider !== 'mta') {
          return;
        }

        const configuredRows = Array.isArray(data?.config?.lines) ? data.config.lines : [];
        const configuredLines = configuredRows
          .map((line: any) => (typeof line?.line === 'string' ? line.line.toUpperCase() : ''))
          .filter((line: string) => line.length > 0);

        if (!cancelled && configuredLines.length > 0) {
          const maxLines = isBusMode ? MAX_SELECTED_BUS_LINES : MAX_SELECTED_LINES;
          setSelectedLines(configuredLines.slice(0, maxLines));
        }

        if (!cancelled && !isBusMode) {
          const subwayRows = configuredRows
            .filter((row: any) => {
              const p = typeof row?.provider === 'string' ? row.provider.toLowerCase() : '';
              return p === 'mta-subway' || p === 'mta';
            })
            .slice(0, MAX_SELECTED_LINES);
          if (subwayRows.length > 0) {
            const mapped: SubwaySelection[] = subwayRows.map((row: any) => {
              const line = typeof row?.line === 'string' ? row.line.toUpperCase() : '';
              const rawStop = typeof row?.stop === 'string' ? row.stop : '';
              const rawDirection = typeof row?.direction === 'string' ? row.direction : '';
              const stopIdForLine = normalizeStopId(rawStop, rawDirection);
              return {
                line,
                stopId: stopIdForLine,
                stopName: stopIdForLine || 'Select stop',
              };
            });
            setSubwaySelections(mapped);
            setActiveSubwaySelectionIndex(0);
          }
        }

        const firstStopId = typeof configuredRows?.[0]?.stop === 'string' ? configuredRows[0].stop : '';
        const firstDirection = typeof configuredRows?.[0]?.direction === 'string' ? configuredRows[0].direction : '';
        if (!cancelled && firstStopId.length > 0) {
          setStopId(normalizeStopId(firstStopId, firstDirection));
        }
        const configuredDisplayType = Number(data?.config?.displayType);
        if (!cancelled && Number.isFinite(configuredDisplayType)) {
          const normalizedPreset = Math.max(1, Math.min(5, Math.trunc(configuredDisplayType)));
          setDisplayType(normalizedPreset);
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
  }, [deviceId, isBusMode, normalizeStopId]);

  useEffect(() => {
    setAllStops([]);
    setStopOptions([]);
    setStopDropdownOpen(false);
    setSubwayStopDropdownOpen(false);
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
      setSubwaySelections([{line: 'E', stopId: DEFAULT_STOP_ID, stopName: DEFAULT_STOP_NAME}]);
      setSubwayAvailableLines([[], []]);
      setSubwayLoadingLines([false, false]);
      setActiveSubwaySelectionIndex(0);
    }
  }, [isBusMode]);

  useEffect(() => {
    let cancelled = false;
    if (!isBusMode) return;

    const run = async () => {
      setIsLoadingBusRoutes(true);
      try {
        const response = await apiFetch('/providers/new-york/routes/bus?limit=1000');
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
    if (!stopDropdownOpen || !isBusMode) return;

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
        const response = await apiFetch(`/providers/new-york/stops/bus?route=${encodeURIComponent(primaryRoute)}&limit=1000`);
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
    if (!isBusMode || !stopDropdownOpen) {
      setStopOptions([]);
      return;
    }
    setStopOptions(allStops);
  }, [isBusMode, stopDropdownOpen, allStops]);

  useEffect(() => {
    let cancelled = false;
    if (isBusMode) return;

    const run = async () => {
      setIsLoadingStops(true);
      setStopsError('');
      try {
        const response = await apiFetch('/stops?limit=1000');
        if (!response.ok) {
          if (!cancelled) setStopsError('Failed to load stops');
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          const options = Array.isArray(data?.stops) ? (data.stops as StopOption[]) : [];
          setSubwayAllStops(options);
          if (options.length === 0) setStopsError('No stops found');
        }
      } catch {
        if (!cancelled) {
          setSubwayAllStops([]);
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
  }, [isBusMode]);

  useEffect(() => {
    if (isBusMode || subwayAllStops.length === 0) return;
    setSubwaySelections(prev =>
      prev.map(entry => {
        const match = subwayAllStops.find(stop => stop.stopId.toUpperCase() === entry.stopId.toUpperCase());
        if (!match) return entry;
        return {...entry, stopName: match.stop};
      }),
    );
  }, [isBusMode, subwayAllStops]);

  useEffect(() => {
    let cancelled = false;
    if (isBusMode) return;

    const fetchLinesFor = async (stopIdForLine: string, index: number) => {
      const normalizedStopId = stopIdForLine.trim().toUpperCase();
      if (!normalizedStopId) {
        if (!cancelled) {
          setSubwayAvailableLines(prev => {
            const next = [...prev];
            next[index] = [];
            return next;
          });
        }
        return;
      }

      setSubwayLoadingLines(prev => {
        const next = [...prev];
        next[index] = true;
        return next;
      });
      try {
        const response = await apiFetch(`/stops/${encodeURIComponent(normalizedStopId)}/lines`);
        if (!response.ok) {
          if (!cancelled) {
            setSubwayAvailableLines(prev => {
              const next = [...prev];
              next[index] = [];
              return next;
            });
          }
          return;
        }

        const data = await response.json();
        const lines = Array.isArray(data?.lines)
          ? data.lines
              .map((line: unknown) => (typeof line === 'string' ? line.toUpperCase() : ''))
              .filter((line: string) => line.length > 0)
          : [];

        if (!cancelled) {
          setSubwayAvailableLines(prev => {
            const next = [...prev];
            next[index] = lines;
            return next;
          });
          setSubwaySelections(prev => {
            if (index >= prev.length) return prev;
            const current = prev[index];
            if (current.line && lines.includes(current.line)) return prev;
            const replacement = lines[0] ?? '';
            const next = [...prev];
            next[index] = {...current, line: replacement};
            return next;
          });
        }
      } catch {
        if (!cancelled) {
          setSubwayAvailableLines(prev => {
            const next = [...prev];
            next[index] = [];
            return next;
          });
        }
      } finally {
        if (!cancelled) {
          setSubwayLoadingLines(prev => {
            const next = [...prev];
            next[index] = false;
            return next;
          });
        }
      }
    };

    void fetchLinesFor(subwaySelections[0]?.stopId ?? '', 0);
    void fetchLinesFor(subwaySelections[1]?.stopId ?? '', 1);

    return () => {
      cancelled = true;
    };
  }, [isBusMode, subwaySelections]);

  useEffect(() => {
    if (!stopDropdownOpen) {
      setStopOptions([]);
      return;
    }
    setStopOptions(allStops);
  }, [allStops, stopDropdownOpen]);

  useEffect(() => {
    if (!isBusMode) return;
    const normalizedLine = (selectedLines[0] ?? '').trim().toUpperCase();
    if (!normalizedLine.length) {
      setAvailableLines([]);
      setSelectedLines([]);
      return;
    }
    setAvailableLines([normalizedLine]);
  }, [isBusMode, selectedLines]);

  const chooseStop = useCallback((option: StopOption) => {
    const normalizedStopId = option.stopId.toUpperCase();
    if (isBusMode) {
      setStopId(normalizedStopId);
      setStopName(option.stop);
      setStopDropdownOpen(false);
    } else {
      setSubwaySelections(prev => {
        const next = [...prev];
        const index = activeSubwaySelectionIndex;
        if (!next[index]) return prev;
        next[index] = {...next[index], stopId: normalizedStopId, stopName: option.stop};
        return next;
      });
      setSubwayStopDropdownOpen(false);
    }
    setStopOptions([]);
    setStopError('');
    setStatusText('');
  }, [activeSubwaySelectionIndex, isBusMode]);

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
    setSubwaySelections(prev => {
      const next = [...prev];
      const index = activeSubwaySelectionIndex;
      if (!next[index]) return prev;
      next[index] = {...next[index], line};
      return next;
    });
  }, [activeSubwaySelectionIndex, isBusMode]);

  const saveConfig = useCallback(async () => {
    if (!deviceId) return;
    setIsSaving(true);
    setStatusText('');

    try {
      let payloadLines: Array<{provider: string; line: string; stop: string; direction?: 'N' | 'S'}> = [];
      if (isBusMode) {
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
        payloadLines = selectedLines.map(line => ({
          provider: 'mta-bus',
          line,
          stop: normalizedStopId,
        }));
      } else {
        const validSelections = subwaySelections
          .map(sel => ({
            line: sel.line.trim().toUpperCase(),
            stopId: sel.stopId.trim().toUpperCase(),
          }))
          .filter(sel => sel.line.length > 0 && sel.stopId.length > 0)
          .slice(0, MAX_SELECTED_LINES);

        if (validSelections.length === 0) {
          setStatusText('Pick at least one train and stop');
          setStopError('Choose stop + line');
          setIsSaving(false);
          return;
        }

        payloadLines = validSelections.map(sel => ({
          provider: 'mta-subway',
          line: sel.line,
          stop: sel.stopId,
          direction: sel.stopId.endsWith('S') ? 'S' : 'N',
        }));
      }

      const configResponse = await apiFetch(`/device/${deviceId}/config`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          displayType,
          lines: payloadLines,
        }),
      });

      if (!configResponse.ok) {
        const data = await configResponse.json().catch(() => null);
        const message =
          typeof data?.error === 'string'
            ? data.error
            : `Failed to save line (${configResponse.status})`;
        setStatusText(message);
        return;
      }

      await apiFetch(`/refresh/device/${deviceId}`, {method: 'POST'});
      if (isBusMode) {
        const normalizedStopId = stopId.trim().toUpperCase();
        setStatusText(`Updated ${selectedLines.join(', ')} at ${normalizedStopId}`);
      } else {
        setStatusText(`Updated ${payloadLines.map(row => `${row.line}@${row.stop}`).join(', ')}`);
      }
    } catch {
      setStatusText('Network error');
    } finally {
      setIsSaving(false);
    }
  }, [deviceId, selectedLines, stopId, isBusMode, displayType, subwaySelections]);

  const subwayLineButtons = useCallback((index: 0 | 1) => {
    const lines = subwayAvailableLines[index] ?? [];
    const selected = subwaySelections[index]?.line ?? '';
    return lines.map(line => (
      <Pressable
        key={`${index}-${line}`}
        style={[styles.lineChip, selected === line && styles.lineChipActive]}
        onPress={() => {
          setActiveSubwaySelectionIndex(index);
          toggleLine(line);
        }}
        disabled={isSaving || subwayLoadingLines[index]}>
        <Text style={[styles.lineChipText, selected === line && styles.lineChipTextActive]}>{line}</Text>
      </Pressable>
    ));
  }, [isSaving, subwayAvailableLines, subwayLoadingLines, subwaySelections, toggleLine]);

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

        {isBusMode ? (
          <>
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

            {isLoadingStops && <Text style={styles.hintText}>Searching NYC bus stops...</Text>}
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
          </>
        ) : (
          <>
            <Text style={styles.hintText}>Train 1 stop</Text>
            <Pressable
              style={({pressed}) => [
                styles.stationSelector,
                activeSubwaySelectionIndex === 0 && subwayStopDropdownOpen && styles.stationSelectorOpen,
                pressed && styles.stationSelectorPressed,
              ]}
              onPress={() => {
                setActiveSubwaySelectionIndex(0);
                setSubwayStopDropdownOpen(prev => (activeSubwaySelectionIndex === 0 ? !prev : true));
                setStopError('');
                setStopsError('');
              }}>
              <Text style={styles.stationSelectorText}>
                {subwaySelections[0]?.stopName || 'Select stop'} ({subwaySelections[0]?.stopId || '-'})
              </Text>
              <Text style={styles.stationSelectorCaret}>
                {activeSubwaySelectionIndex === 0 && subwayStopDropdownOpen ? '▲' : '▼'}
              </Text>
            </Pressable>

            <Text style={styles.hintText}>Train 2 stop (optional)</Text>
            <Pressable
              style={({pressed}) => [
                styles.stationSelector,
                activeSubwaySelectionIndex === 1 && subwayStopDropdownOpen && styles.stationSelectorOpen,
                pressed && styles.stationSelectorPressed,
              ]}
              onPress={() => {
                setSubwaySelections(prev => {
                  if (prev.length >= 2) return prev;
                  return [...prev, {line: '', stopId: '', stopName: 'Select stop'}];
                });
                setActiveSubwaySelectionIndex(1);
                setSubwayStopDropdownOpen(prev => (activeSubwaySelectionIndex === 1 ? !prev : true));
                setStopError('');
                setStopsError('');
              }}>
              <Text style={styles.stationSelectorText}>
                {subwaySelections[1]?.stopName || 'Select stop'} ({subwaySelections[1]?.stopId || '-'})
              </Text>
              <Text style={styles.stationSelectorCaret}>
                {activeSubwaySelectionIndex === 1 && subwayStopDropdownOpen ? '▲' : '▼'}
              </Text>
            </Pressable>

            {subwaySelections.length > 1 && (
              <Pressable
                style={[styles.stationSelector, {marginTop: 0}]}
                onPress={() => {
                  setSubwaySelections(prev => prev.slice(0, 1));
                  setSubwayAvailableLines(prev => [prev[0] ?? [], []]);
                  setSubwayLoadingLines(prev => [prev[0] ?? false, false]);
                  setActiveSubwaySelectionIndex(0);
                  setSubwayStopDropdownOpen(false);
                }}>
                <Text style={styles.stationSelectorText}>Remove Train 2</Text>
              </Pressable>
            )}

            {isLoadingStops && <Text style={styles.hintText}>Loading NYC subway stops...</Text>}
            {subwayStopDropdownOpen && (
              <View style={styles.stopList}>
                <ScrollView style={styles.stopListScroll} nestedScrollEnabled>
                  {!isLoadingStops && subwayAllStops.length === 0 && (
                    <Text style={styles.stopItemSubtitle}>{stopsError || 'No stops available'}</Text>
                  )}
                  {subwayAllStops.map(option => {
                    const activeStopId = subwaySelections[activeSubwaySelectionIndex]?.stopId ?? '';
                    const isSelected = option.stopId.toUpperCase() === activeStopId.toUpperCase();
                    return (
                      <Pressable
                        key={`${activeSubwaySelectionIndex}-${option.stopId}`}
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
          </>
        )}
        {!!stopError && <Text style={styles.errorText}>{stopError}</Text>}
      </View>

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
        <Text style={styles.sectionTitle}>{isBusMode ? 'NYC Bus' : 'NYC Trains'}</Text>
        <Text style={styles.hintText}>{isBusMode ? `Selected route for ${stopId}.` : 'Each train can use a different stop.'}</Text>
        {isBusMode ? (
          <>
            <Text style={styles.destFixed}>Selected: {selectedLines.join(', ') || 'None'}</Text>
            {isLoadingLines && <Text style={styles.hintText}>Loading lines...</Text>}
            {!isLoadingLines && availableLines.length === 0 && (
              <Text style={styles.hintText}>No lines found for this stop yet.</Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.hintText}>Train 1 line ({subwaySelections[0]?.stopId || '-'})</Text>
            {subwayLoadingLines[0] && <Text style={styles.hintText}>Loading train 1 lines...</Text>}
            {!subwayLoadingLines[0] && (subwayAvailableLines[0]?.length ?? 0) === 0 && (
              <Text style={styles.hintText}>No lines for train 1 stop.</Text>
            )}
            <View style={styles.lineGrid}>{subwayLineButtons(0)}</View>

            {subwaySelections.length > 1 && (
              <>
                <Text style={styles.hintText}>Train 2 line ({subwaySelections[1]?.stopId || '-'})</Text>
                {subwayLoadingLines[1] && <Text style={styles.hintText}>Loading train 2 lines...</Text>}
                {!subwayLoadingLines[1] && (subwayAvailableLines[1]?.length ?? 0) === 0 && (
                  <Text style={styles.hintText}>No lines for train 2 stop.</Text>
                )}
                <View style={styles.lineGrid}>{subwayLineButtons(1)}</View>
              </>
            )}
            <Text style={styles.destFixed}>
              Selected:{' '}
              {subwaySelections
                .filter(sel => sel.line && sel.stopId)
                .map(sel => `${sel.line}@${sel.stopId}`)
                .join(', ') || 'None'}
            </Text>
          </>
        )}

        <Pressable
          style={styles.saveButton}
          onPress={saveConfig}
          disabled={isSaving || isLoadingStops || (isBusMode && (isLoadingLines || isLoadingBusRoutes))}>
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
