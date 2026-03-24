<<<<<<< Updated upstream
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useMutation, useQueryClient} from '@tanstack/react-query';
=======
import React, {useCallback, useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
>>>>>>> Stashed changes
import {colors, radii, spacing} from '../../../theme';
import {apiFetch} from '../../../lib/api';
import {extractConfigDisplayId} from '../../../lib/deviceConfig';
import {queryKeys} from '../../../lib/queryKeys';

<<<<<<< Updated upstream
const DEFAULT_STOP_ID = '';
const DEFAULT_STOP_NAME = 'Select stop';
const MAX_SELECTED_LINES = 2;
const MAX_SELECTED_BUS_LINES = 1;
const DISPLAY_PRESETS = [1, 2, 3, 4, 5] as const;

type StopOption = {stopId: string; stop: string; direction?: 'N' | 'S' | ''};
type BusRouteOption = {id: string; label: string};
type SubwayDirection = '' | 'N' | 'S';
type SubwaySelection = {line: string; stopId: string; stopName: string; direction: SubwayDirection};
=======
const MAX_SUBWAY_ROWS = 2;
const DISPLAY_PRESETS = [1, 2, 3, 4, 5] as const;

type StationOption = {stopId: string; name: string};
type LineOption = {id: string; label: string};
type SubwaySelection = {stopId: string; stopName: string; direction: 'N' | 'S'; line: string};
>>>>>>> Stashed changes

type Props = {
  deviceId: string;
  providerId?: 'mta-subway' | 'mta-bus';
};

export default function NycSubwayConfig({deviceId, providerId = 'mta-subway'}: Props) {
  const queryClient = useQueryClient();
  const isBusMode = providerId === 'mta-bus';
<<<<<<< Updated upstream
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
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
  const [activeDisplayId, setActiveDisplayId] = useState<string | null>(null);
  const [subwaySelections, setSubwaySelections] = useState<SubwaySelection[]>([
    {line: '', stopId: DEFAULT_STOP_ID, stopName: DEFAULT_STOP_NAME, direction: ''},
=======

  // ─── Shared ────────────────────────────────────────────────────────────
  const [displayType, setDisplayType] = useState<number>(1);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');

  // ─── Subway mode state ─────────────────────────────────────────────────
  const [subwaySelections, setSubwaySelections] = useState<SubwaySelection[]>([
    {stopId: '', stopName: 'Select stop', direction: 'N', line: ''},
>>>>>>> Stashed changes
  ]);
  const [activeSelectionIndex, setActiveSelectionIndex] = useState<0 | 1>(0);
  const [subwaySearchQuery, setSubwaySearchQuery] = useState('');
  const [subwaySearchResults, setSubwaySearchResults] = useState<StationOption[]>([]);
  const [subwayStopDropdownOpen, setSubwayStopDropdownOpen] = useState(false);
  const [isSearchingStops, setIsSearchingStops] = useState(false);
  const [subwayAvailableLines, setSubwayAvailableLines] = useState<LineOption[][]>([[], []]);
  const [subwayLoadingLines, setSubwayLoadingLines] = useState<boolean[]>([false, false]);

<<<<<<< Updated upstream
  const normalizeStopId = useCallback((rawStop: string, rawDirection: string) => {
    const normalized = rawStop.trim().toUpperCase();
    if (!normalized.length) return '';
    if (isBusMode) {
      if (normalized.endsWith('N') || normalized.endsWith('S')) return normalized;
      const direction = rawDirection.trim().toUpperCase();
      if (direction === 'N' || direction === 'S') return `${normalized}${direction}`;
      return normalized;
    }
    if (!isBusMode && (normalized.endsWith('N') || normalized.endsWith('S'))) {
      return normalized.slice(0, -1);
    }
    return normalized;
  }, [isBusMode]);

  const normalizeSubwayDirection = useCallback((rawDirection: string, rawStop: string): 'N' | 'S' => {
    const normalizedDirection = rawDirection.trim().toUpperCase();
    if (normalizedDirection === 'S') return 'S';
    if (normalizedDirection === 'N') return 'N';
    return rawStop.trim().toUpperCase().endsWith('S') ? 'S' : 'N';
  }, []);
=======
  // ─── Bus mode state ────────────────────────────────────────────────────
  const [busQuery, setBusQuery] = useState('');
  const [busStopOptions, setBusStopOptions] = useState<StationOption[]>([]);
  const [busStopDropdownOpen, setBusStopDropdownOpen] = useState(false);
  const [isLoadingBusStops, setIsLoadingBusStops] = useState(false);
  const [busStopId, setBusStopId] = useState('');
  const [busStopName, setBusStopName] = useState('Select bus stop');
  const [busLines, setBusLines] = useState<LineOption[]>([]);
  const [busSelectedLine, setBusSelectedLine] = useState('');
  const [isLoadingBusLines, setIsLoadingBusLines] = useState(false);
>>>>>>> Stashed changes

  // ─── Reset on mode change ──────────────────────────────────────────────
  useEffect(() => {
    setStatusText('');
    setSubwaySelections([{stopId: '', stopName: 'Select stop', direction: 'N', line: ''}]);
    setSubwaySearchQuery('');
    setSubwaySearchResults([]);
    setSubwayStopDropdownOpen(false);
    setSubwayAvailableLines([[], []]);
    setSubwayLoadingLines([false, false]);
    setActiveSelectionIndex(0);
    setBusQuery('');
    setBusStopOptions([]);
    setBusStopDropdownOpen(false);
    setBusStopId('');
    setBusStopName('Select bus stop');
    setBusLines([]);
    setBusSelectedLine('');
  }, [isBusMode]);

  // ─── Load saved config ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
<<<<<<< Updated upstream
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
        const firstProvider = typeof data?.config?.lines?.[0]?.provider === 'string' ? data.config.lines[0].provider : '';
        if (isBusMode) {
          if (firstProvider !== 'mta-bus') return;
        } else if (firstProvider !== 'mta-subway' && firstProvider !== 'mta') {
          return;
        }
=======
        const response = await apiFetch(`/device/${deviceId}/config`);
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const rows: any[] = Array.isArray(data?.config?.lines) ? data.config.lines : [];
>>>>>>> Stashed changes

        const targetProvider = isBusMode ? 'mta-bus' : 'mta-subway';
        const matchingRows = rows.filter(
          row =>
            typeof row?.provider === 'string' &&
            (row.provider === targetProvider || (!isBusMode && row.provider === 'mta')),
        );
        if (matchingRows.length === 0) return;

<<<<<<< Updated upstream
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
                direction: normalizeSubwayDirection(rawDirection, rawStop),
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
=======
>>>>>>> Stashed changes
        const configuredDisplayType = Number(data?.config?.displayType);
        if (!cancelled && Number.isFinite(configuredDisplayType)) {
          setDisplayType(Math.max(1, Math.min(5, Math.trunc(configuredDisplayType))));
        }

        if (!cancelled && isBusMode) {
          const row = matchingRows[0];
          const savedLine = typeof row?.line === 'string' ? row.line.toUpperCase() : '';
          const savedStop = typeof row?.stop === 'string' ? row.stop : '';
          if (savedLine) setBusSelectedLine(savedLine);
          if (savedStop) {
            setBusStopId(savedStop);
            setBusStopName(savedStop);
          }
        } else if (!cancelled) {
          const mapped: SubwaySelection[] = matchingRows.slice(0, MAX_SUBWAY_ROWS).map((row: any) => {
            const line = typeof row?.line === 'string' ? row.line.toUpperCase() : '';
            const rawStop = typeof row?.stop === 'string' ? row.stop : '';
            const rawDir = typeof row?.direction === 'string' ? row.direction.toUpperCase() : 'N';
            // Strip direction suffix from stop ID to get parent station ID
            const stopId =
              rawStop.endsWith('N') || rawStop.endsWith('S') ? rawStop.slice(0, -1) : rawStop;
            const direction: 'N' | 'S' = rawDir === 'S' ? 'S' : 'N';
            return {line, stopId, stopName: stopId || 'Select stop', direction};
          });
          setSubwaySelections(mapped);
        }
      } catch {
        // Keep defaults.
      }
    };

    if (deviceId) void loadConfig();
    return () => {
      cancelled = true;
    };
<<<<<<< Updated upstream
  }, [deviceId, isBusMode, normalizeStopId, normalizeSubwayDirection, queryClient]);

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
      setSelectedLines(prev => (prev.length > 0 ? prev.slice(0, MAX_SELECTED_LINES) : []));
      setStopId(DEFAULT_STOP_ID);
      setStopName(DEFAULT_STOP_NAME);
      setSubwaySelections([{line: '', stopId: DEFAULT_STOP_ID, stopName: DEFAULT_STOP_NAME, direction: ''}]);
      setSubwayAvailableLines([[], []]);
      setSubwayLoadingLines([false, false]);
      setActiveSubwaySelectionIndex(0);
    }
  }, [isBusMode]);
=======
  }, [deviceId, isBusMode]);
>>>>>>> Stashed changes

  // ─── Subway: search stations ───────────────────────────────────────────
  useEffect(() => {
    if (isBusMode || !subwayStopDropdownOpen) return;
    let cancelled = false;
    const run = async () => {
      setIsSearchingStops(true);
      try {
<<<<<<< Updated upstream
        const result = await queryClient.fetchQuery({
          queryKey: ['providers', 'new-york', 'routes', 'bus', 'limit:1000'],
          queryFn: async () => {
            const response = await apiFetch('/providers/new-york/routes/bus?limit=1000');
            const data = await response.json().catch(() => null);
            return {ok: response.ok, data};
          },
        });
        if (!result.ok) return;
        const data = result.data;
=======
        const q = subwaySearchQuery.trim();
        const url = q
          ? `/mta/stations?mode=subway&q=${encodeURIComponent(q)}&limit=50`
          : `/mta/stations?mode=subway&limit=50`;
        const response = await apiFetch(url);
        if (!response.ok || cancelled) return;
        const data = await response.json();
>>>>>>> Stashed changes
        if (!cancelled) {
          setSubwaySearchResults(Array.isArray(data?.stations) ? data.stations : []);
        }
      } catch {
        if (!cancelled) setSubwaySearchResults([]);
      } finally {
        if (!cancelled) setIsSearchingStops(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
<<<<<<< Updated upstream
  }, [isBusMode, queryClient]);
=======
  }, [isBusMode, subwayStopDropdownOpen, subwaySearchQuery]);
>>>>>>> Stashed changes

  // ─── Subway: fetch lines for each selection ────────────────────────────
  useEffect(() => {
    if (isBusMode) return;
    let cancelled = false;

    const fetchLines = async (stopId: string, index: number) => {
      if (!stopId) {
        setSubwayAvailableLines(prev => {
          const next = [...prev];
          next[index] = [];
          return next;
        });
        return;
      }
<<<<<<< Updated upstream
      setIsLoadingStops(true);
      setStopsError('');
      try {
        const result = await queryClient.fetchQuery({
          queryKey: ['providers', 'new-york', 'stops', 'bus', primaryRoute, 'limit:1000'],
          queryFn: async () => {
            const response = await apiFetch(`/providers/new-york/stops/bus?route=${encodeURIComponent(primaryRoute)}&limit=1000`);
            const data = await response.json().catch(() => null);
            return {ok: response.ok, data};
          },
        });
        if (!result.ok) {
          if (!cancelled) setStopsError('Failed to load stops');
          return;
        }
        const data = result.data;
        if (!cancelled) {
          const options = Array.isArray(data?.stops) ? (data.stops as StopOption[]) : [];
          setAllStops(options);
          if (options.length === 0) setStopsError('No stops found');
        }
      } catch {
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
  }, [isBusMode, queryClient, selectedLines, stopDropdownOpen]);

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
        const result = await queryClient.fetchQuery({
          queryKey: ['mta', 'stations', 'subway', 'limit:1000'],
          queryFn: async () => {
            const response = await apiFetch('/mta/stations?mode=subway&limit=1000');
            const data = await response.json().catch(() => null);
            return {ok: response.ok, data};
          },
        });
        if (!result.ok) {
          if (!cancelled) setStopsError('Failed to load stops');
          return;
        }
        const data = result.data;
        if (!cancelled) {
          const options: StopOption[] = Array.isArray(data?.stations)
            ? data.stations
                .map((row: any) => ({
                  stopId: typeof row?.stopId === 'string' ? row.stopId.trim().toUpperCase() : '',
                  stop: typeof row?.name === 'string' ? row.name : '',
                }))
                .filter((row: StopOption) => row.stopId.length > 0 && row.stop.length > 0)
            : [];
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
  }, [isBusMode, queryClient]);

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

=======
>>>>>>> Stashed changes
      setSubwayLoadingLines(prev => {
        const next = [...prev];
        next[index] = true;
        return next;
      });
      try {
<<<<<<< Updated upstream
        const result = await queryClient.fetchQuery({
          queryKey: queryKeys.transitLinesForStation('new-york', 'train', normalizedStopId),
          queryFn: async () => {
            const response = await apiFetch(`/mta/stations/subway/${encodeURIComponent(normalizedStopId)}/lines`);
            const data = await response.json().catch(() => null);
            return {ok: response.ok, data};
          },
        });
        if (!result.ok) {
          if (!cancelled) {
            setSubwayAvailableLines(prev => {
              const next = [...prev];
              next[index] = [];
              return next;
            });
          }
          return;
        }

        const data = result.data;
        const lines = Array.isArray(data?.lines)
          ? data.lines
              .map((line: unknown) => {
                if (typeof line === 'string') return line.toUpperCase();
                if (line && typeof line === 'object' && typeof (line as {id?: unknown}).id === 'string') {
                  return (line as {id: string}).id.toUpperCase();
                }
                return '';
              })
              .filter((line: string) => line.length > 0)
=======
        const response = await apiFetch(
          `/mta/stations/subway/${encodeURIComponent(stopId)}/lines`,
        );
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const lines: LineOption[] = Array.isArray(data?.lines)
          ? data.lines
              .map((l: any) => ({
                id: typeof l?.id === 'string' ? l.id : '',
                label: typeof l?.label === 'string' ? l.label : (l?.id ?? ''),
              }))
              .filter((l: LineOption) => l.id.length > 0)
>>>>>>> Stashed changes
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
            if (current.line && lines.some(l => l.id === current.line)) return prev;
            const next = [...prev];
            next[index] = {...current, line: lines[0]?.id ?? ''};
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

    void fetchLines(subwaySelections[0]?.stopId ?? '', 0);
    void fetchLines(subwaySelections[1]?.stopId ?? '', 1);
    return () => {
      cancelled = true;
    };
<<<<<<< Updated upstream
  }, [isBusMode, queryClient, subwaySelections[0]?.stopId, subwaySelections[1]?.stopId]);
=======
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBusMode, subwaySelections[0]?.stopId, subwaySelections[1]?.stopId]);

  // ─── Bus: search stops ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isBusMode || !busStopDropdownOpen) return;
    let cancelled = false;
    const run = async () => {
      setIsLoadingBusStops(true);
      try {
        const q = busQuery.trim();
        const url = q
          ? `/mta/stations?mode=bus&q=${encodeURIComponent(q)}&limit=50`
          : `/mta/stations?mode=bus&limit=50`;
        const response = await apiFetch(url);
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (!cancelled) {
          setBusStopOptions(Array.isArray(data?.stations) ? data.stations : []);
        }
      } catch {
        if (!cancelled) setBusStopOptions([]);
      } finally {
        if (!cancelled) setIsLoadingBusStops(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isBusMode, busStopDropdownOpen, busQuery]);
>>>>>>> Stashed changes

  // ─── Bus: fetch lines when stop selected ──────────────────────────────
  useEffect(() => {
    if (!isBusMode || !busStopId) return;
    let cancelled = false;
    const run = async () => {
      setIsLoadingBusLines(true);
      try {
        const response = await apiFetch(
          `/mta/stations/bus/${encodeURIComponent(busStopId)}/lines`,
        );
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const lines: LineOption[] = Array.isArray(data?.lines)
          ? data.lines
              .map((l: any) => ({
                id: typeof l?.id === 'string' ? l.id : '',
                label: typeof l?.label === 'string' ? l.label : (l?.id ?? ''),
              }))
              .filter((l: LineOption) => l.id.length > 0)
          : [];
        if (!cancelled) {
          setBusLines(lines);
          setBusSelectedLine(prev =>
            lines.some(l => l.id === prev) ? prev : (lines[0]?.id ?? ''),
          );
        }
      } catch {
        if (!cancelled) setBusLines([]);
      } finally {
        if (!cancelled) setIsLoadingBusLines(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isBusMode, busStopId]);

  // ─── Callbacks ─────────────────────────────────────────────────────────
  const chooseSubwayStop = useCallback(
    (option: StationOption) => {
      setSubwaySelections(prev => {
        const next = [...prev];
<<<<<<< Updated upstream
        const index = activeSubwaySelectionIndex;
        if (!next[index]) return prev;
        next[index] = {...next[index], stopId: normalizedStopId, stopName: option.stop, direction: ''};
=======
        const idx = activeSelectionIndex;
        if (!next[idx]) return prev;
        next[idx] = {...next[idx], stopId: option.stopId, stopName: option.name};
>>>>>>> Stashed changes
        return next;
      });
      setSubwayStopDropdownOpen(false);
      setSubwaySearchQuery('');
      setSubwaySearchResults([]);
      setStatusText('');
    },
    [activeSelectionIndex],
  );

  const chooseBusStop = useCallback((option: StationOption) => {
    setBusStopId(option.stopId);
    setBusStopName(option.name);
    setBusStopDropdownOpen(false);
    setBusSelectedLine('');
    setStatusText('');
  }, []);

<<<<<<< Updated upstream
  const toggleLineAtIndex = useCallback((line: string, index: 0 | 1) => {
    if (isBusMode) {
      setSelectedLines([line]);
      return;
    }
    setStatusText('');
    setSubwaySelections(prev => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = {...next[index], line};
      return next;
    });
  }, [isBusMode]);

  const toggleSubwayDirectionAtIndex = useCallback((direction: 'N' | 'S', index: 0 | 1) => {
    if (isBusMode) return;
    const shouldAdvanceToSecondStop = index === 0 && !(subwaySelections[1]?.stopId?.trim());
    setStatusText('');
    setStopError('');
    setSubwaySelections(prev => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = {...next[index], direction};
      return next;
    });
    if (shouldAdvanceToSecondStop) {
      setSubwaySelections(prev => {
        if (prev.length >= 2) return prev;
        return [...prev, {line: '', stopId: '', stopName: 'Select stop', direction: ''}];
      });
      setActiveSubwaySelectionIndex(1);
      setSubwayStopDropdownOpen(true);
    }
  }, [isBusMode, subwaySelections]);

  const saveConfigMutation = useMutation({
    mutationFn: async (payload: {
      nextDeviceId: string;
      nextDisplayId: string | null;
      nextDisplayType: number;
      payloadLines: Array<{provider: string; line: string; stop: string; direction?: 'N' | 'S'}>;
    }) => {
      const configResponse = await apiFetch(`/device/${payload.nextDeviceId}/config`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          displayId: payload.nextDisplayId ?? undefined,
          displayType: payload.nextDisplayType,
          lines: payload.payloadLines,
        }),
      });
      const configData = await configResponse.json().catch(() => null);
      if (!configResponse.ok) {
        return {
          ok: false as const,
          status: configResponse.status,
          configData,
        };
      }
      await apiFetch(`/refresh/device/${payload.nextDeviceId}`, {method: 'POST'});
      return {
        ok: true as const,
        configData,
      };
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({queryKey: queryKeys.deviceConfig(variables.nextDeviceId)});
      void queryClient.invalidateQueries({queryKey: queryKeys.displays(variables.nextDeviceId)});
    },
  });

=======
>>>>>>> Stashed changes
  const saveConfig = useCallback(async () => {
    if (!deviceId) return;
    setIsSaving(true);
    setStatusText('');
    try {
      let payloadLines: Array<{provider: string; line: string; stop: string; direction?: string}> =
        [];

      if (isBusMode) {
        if (!busStopId || !busSelectedLine) {
          setStatusText('Select a bus stop and line');
          setIsSaving(false);
          return;
        }
        payloadLines = [{provider: 'mta-bus', line: busSelectedLine, stop: busStopId}];
      } else {
<<<<<<< Updated upstream
        const normalizedSelections = subwaySelections
          .map(sel => ({
            line: sel.line.trim().toUpperCase(),
            stopId: sel.stopId.trim().toUpperCase(),
            direction: sel.direction,
          }));
        const incompleteDirection = normalizedSelections.find(
          sel => (sel.line.length > 0 || sel.stopId.length > 0) && !sel.direction,
        );
        if (incompleteDirection) {
          setStatusText('Select a direction for each chosen train stop');
          setStopError('Choose northbound or southbound before saving');
          setIsSaving(false);
          return;
        }
        const validSelections = normalizedSelections
          .filter(
            (sel): sel is {line: string; stopId: string; direction: 'N' | 'S'} =>
              sel.line.length > 0 && sel.stopId.length > 0 && (sel.direction === 'N' || sel.direction === 'S'),
          )
          .slice(0, MAX_SELECTED_LINES);

        if (validSelections.length === 0) {
          setStatusText('Pick at least one train and stop');
          setStopError('Choose stop + line');
=======
        const valid = subwaySelections
          .filter(sel => sel.stopId && sel.line)
          .slice(0, MAX_SUBWAY_ROWS);
        if (valid.length === 0) {
          setStatusText('Pick at least one stop and train line');
>>>>>>> Stashed changes
          setIsSaving(false);
          return;
        }
        payloadLines = valid.map(sel => ({
          provider: 'mta-subway',
          line: sel.line,
<<<<<<< Updated upstream
          stop: sel.stopId,
=======
          stop: sel.stopId + sel.direction, // compose directional stop ID for device
>>>>>>> Stashed changes
          direction: sel.direction,
        }));
      }

<<<<<<< Updated upstream
      const result = await saveConfigMutation.mutateAsync({
        nextDeviceId: deviceId,
        nextDisplayId: activeDisplayId,
        nextDisplayType: displayType,
        payloadLines,
      });

      if (!result.ok) {
        const message =
          typeof result.configData?.error === 'string'
            ? result.configData.error
            : `Failed to save line (${result.status})`;
        setStatusText(message);
        return;
      }

      setActiveDisplayId(extractConfigDisplayId(result.configData));
      if (isBusMode) {
        const normalizedStopId = stopId.trim().toUpperCase();
        setStatusText(`Updated ${selectedLines.join(', ')} at ${normalizedStopId}`);
      } else {
        setStatusText(`Updated ${payloadLines.map(row => `${row.line}@${row.stop}${row.direction ? `(${row.direction})` : ''}`).join(', ')}`);
      }
=======
      const configResponse = await apiFetch(`/device/${deviceId}/config`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({displayType, lines: payloadLines}),
      });

      if (!configResponse.ok) {
        const data = await configResponse.json().catch(() => null);
        setStatusText(
          typeof data?.error === 'string'
            ? data.error
            : `Save failed (${configResponse.status})`,
        );
        return;
      }

      await apiFetch(`/refresh/device/${deviceId}`, {method: 'POST'});
      setStatusText(
        isBusMode
          ? `Updated ${busSelectedLine} @ ${busStopName} (${busStopId})`
          : `Updated ${payloadLines.map(r => `${r.line}@${r.stop}`).join(', ')}`,
      );
>>>>>>> Stashed changes
    } catch {
      setStatusText('Network error');
    } finally {
      setIsSaving(false);
    }
  }, [
<<<<<<< Updated upstream
    activeDisplayId,
    deviceId,
    displayType,
    isBusMode,
    saveConfigMutation,
    selectedLines,
    stopId,
    subwaySelections,
  ]);

  const subwayLineButtons = useCallback((index: 0 | 1) => {
    const lines = subwayAvailableLines[index] ?? [];
    const selected = subwaySelections[index]?.line ?? '';
    return lines.map(line => (
      <Pressable
        key={`${index}-${line}`}
        style={[styles.lineChip, selected === line && styles.lineChipActive]}
        onPress={() => {
          setActiveSubwaySelectionIndex(index);
          toggleLineAtIndex(line, index);
        }}
        disabled={isSaving || subwayLoadingLines[index]}>
        <Text style={[styles.lineChipText, selected === line && styles.lineChipTextActive]}>{line}</Text>
      </Pressable>
    ));
  }, [isSaving, subwayAvailableLines, subwayLoadingLines, subwaySelections, toggleLineAtIndex]);

  const selectedBusRoute = selectedLines[0]?.trim().toUpperCase() ?? '';
  const selectedBusRouteLabel = useMemo(() => {
    if (!selectedBusRoute) return 'Select bus route';
    const match = busRouteOptions.find(option => option.id.toUpperCase() === selectedBusRoute);
    return match?.label ?? selectedBusRoute;
  }, [busRouteOptions, selectedBusRoute]);
=======
    deviceId,
    isBusMode,
    busStopId,
    busStopName,
    busSelectedLine,
    subwaySelections,
    displayType,
  ]);
>>>>>>> Stashed changes

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <>
<<<<<<< Updated upstream
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

            <Text style={styles.hintText}>Train 1 direction</Text>
            <View style={styles.lineGrid}>
              {(['N', 'S'] as const).map(direction => {
                const isActive = subwaySelections[0]?.direction === direction;
                return (
                  <Pressable
                    key={`station-direction-0-${direction}`}
                    style={[styles.lineChip, isActive && styles.lineChipActive]}
                    onPress={() => toggleSubwayDirectionAtIndex(direction, 0)}
                    disabled={isSaving || !subwaySelections[0]?.stopId}>
                    <Text style={[styles.lineChipText, isActive && styles.lineChipTextActive]}>
                      {direction === 'N' ? 'Northbound' : 'Southbound'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.hintText}>Train 2 stop (optional)</Text>
            <Pressable
              style={({pressed}) => [
                styles.stationSelector,
                activeSubwaySelectionIndex === 1 && subwayStopDropdownOpen && styles.stationSelectorOpen,
                pressed && styles.stationSelectorPressed,
              ]}
              onPress={() => {
                if (!subwaySelections[0]?.stopId) {
                  setStopError('Select train 1 stop first');
                  return;
                }
                if (!subwaySelections[0]?.direction) {
                  setStopError('Select train 1 direction before choosing train 2');
                  return;
                }
                setSubwaySelections(prev => {
                  if (prev.length >= 2) return prev;
                  return [...prev, {line: '', stopId: '', stopName: 'Select stop', direction: ''}];
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

            {subwaySelections.length > 1 && (
              <>
                <Text style={styles.hintText}>Train 2 direction</Text>
                <View style={styles.lineGrid}>
                  {(['N', 'S'] as const).map(direction => {
                    const isActive = subwaySelections[1]?.direction === direction;
                    return (
                      <Pressable
                        key={`station-direction-1-${direction}`}
                        style={[styles.lineChip, isActive && styles.lineChipActive]}
                        onPress={() => toggleSubwayDirectionAtIndex(direction, 1)}
                        disabled={isSaving || !subwaySelections[1]?.stopId}>
                        <Text style={[styles.lineChipText, isActive && styles.lineChipTextActive]}>
                          {direction === 'N' ? 'Northbound' : 'Southbound'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
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

=======
      {/* Preset Layout */}
>>>>>>> Stashed changes
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Preset Layout</Text>
        <Text style={styles.hintText}>Choose layout preset for this device (1–5).</Text>
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
              {DISPLAY_PRESETS.map(option => (
                <Pressable
                  key={option}
                  style={({pressed}) => [
                    styles.stopItem,
                    displayType === option && styles.stopItemSelected,
                    pressed && styles.stopItemPressed,
                  ]}
                  onPress={() => {
                    setDisplayType(option);
                    setPresetDropdownOpen(false);
                  }}>
                  <Text style={styles.stopItemTitle}>Preset {option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Station / Stop Config */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{isBusMode ? 'NYC Bus' : 'NYC Subway'}</Text>

        {isBusMode ? (
          <>
            {/* Bus stop search */}
            <Text style={styles.hintText}>Search for a bus stop by name or stop number</Text>
            <TextInput
              value={busQuery}
              onChangeText={setBusQuery}
              placeholder="Stop name or ID (e.g. 5th Av)"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <Pressable
              style={({pressed}) => [
                styles.stationSelector,
                busStopDropdownOpen && styles.stationSelectorOpen,
                pressed && styles.stationSelectorPressed,
              ]}
              onPress={() => setBusStopDropdownOpen(prev => !prev)}>
              <Text style={styles.stationSelectorText}>
                {busStopName}
                {busStopId ? ` (${busStopId})` : ''}
              </Text>
              <Text style={styles.stationSelectorCaret}>{busStopDropdownOpen ? '▲' : '▼'}</Text>
            </Pressable>
            {isLoadingBusStops && <Text style={styles.hintText}>Searching bus stops...</Text>}
            {busStopDropdownOpen && !isLoadingBusStops && (
              <View style={styles.stopList}>
                <ScrollView style={styles.stopListScroll} nestedScrollEnabled>
                  {busStopOptions.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {busQuery.trim() ? 'No stops found' : 'Type to search bus stops'}
                    </Text>
                  ) : (
                    busStopOptions.map(option => (
                      <Pressable
                        key={option.stopId}
                        style={({pressed}) => [
                          styles.stopItem,
                          option.stopId === busStopId && styles.stopItemSelected,
                          pressed && styles.stopItemPressed,
                        ]}
                        onPress={() => chooseBusStop(option)}>
                        <Text style={styles.stopItemTitle}>{option.name}</Text>
                        <Text style={styles.stopItemSubtitle}>{option.stopId}</Text>
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </View>
            )}

            {/* Bus lines at selected stop */}
            {!!busStopId && (
              <>
                <Text style={styles.hintText}>Select bus line at this stop</Text>
                {isLoadingBusLines && <Text style={styles.hintText}>Loading lines...</Text>}
                {!isLoadingBusLines && busLines.length === 0 && (
                  <Text style={styles.hintText}>No lines found for this stop.</Text>
                )}
                <View style={styles.lineGrid}>
                  {busLines.map(line => (
                    <Pressable
                      key={line.id}
                      style={[styles.lineChip, busSelectedLine === line.id && styles.lineChipActive]}
                      onPress={() => {
                        setBusSelectedLine(line.id);
                        setStatusText('');
                      }}>
                      <Text
                        style={[
                          styles.lineChipText,
                          busSelectedLine === line.id && styles.lineChipTextActive,
                        ]}>
                        {line.id}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </>
        ) : (
          <>
            {/* Subway selections */}
            {([0, 1] as const).map(index => {
              const sel = subwaySelections[index];
              const isSecond = index === 1;
              const hasSecond = subwaySelections.length >= 2;

<<<<<<< Updated upstream
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
                .filter(sel => sel.line && sel.stopId && sel.direction)
                .map(sel => `${sel.line}@${sel.stopId}(${sel.direction})`)
                .join(', ') || 'None'}
            </Text>
=======
              if (isSecond && !hasSecond) {
                return (
                  <Pressable
                    key="add-second"
                    style={[styles.stationSelector, {marginTop: 0}]}
                    onPress={() => {
                      setSubwaySelections(prev => [
                        ...prev,
                        {stopId: '', stopName: 'Select stop', direction: 'N', line: ''},
                      ]);
                      setActiveSelectionIndex(1);
                      setSubwayStopDropdownOpen(true);
                      setSubwaySearchQuery('');
                    }}>
                    <Text style={styles.stationSelectorText}>+ Add Train 2 (optional)</Text>
                  </Pressable>
                );
              }

              if (isSecond && !sel) return null;

              const isActiveDropdown = activeSelectionIndex === index && subwayStopDropdownOpen;

              return (
                <View key={index} style={styles.selectionBlock}>
                  <Text style={styles.hintText}>Train {index + 1}{isSecond ? ' (optional)' : ''}</Text>

                  {/* Stop selector button */}
                  <Pressable
                    style={({pressed}) => [
                      styles.stationSelector,
                      isActiveDropdown && styles.stationSelectorOpen,
                      pressed && styles.stationSelectorPressed,
                    ]}
                    onPress={() => {
                      setActiveSelectionIndex(index);
                      setSubwayStopDropdownOpen(prev =>
                        activeSelectionIndex === index ? !prev : true,
                      );
                      setSubwaySearchQuery('');
                      setSubwaySearchResults([]);
                    }}>
                    <Text style={styles.stationSelectorText}>
                      {sel?.stopName ?? 'Select stop'}
                      {sel?.stopId ? ` (${sel.stopId})` : ''}
                    </Text>
                    <Text style={styles.stationSelectorCaret}>{isActiveDropdown ? '▲' : '▼'}</Text>
                  </Pressable>

                  {/* Search input and dropdown */}
                  {isActiveDropdown && (
                    <>
                      <TextInput
                        value={subwaySearchQuery}
                        onChangeText={setSubwaySearchQuery}
                        placeholder="Search station name or ID"
                        placeholderTextColor={colors.textMuted}
                        style={styles.input}
                        autoFocus
                      />
                      <View style={styles.stopList}>
                        <ScrollView style={styles.stopListScroll} nestedScrollEnabled>
                          {isSearchingStops && (
                            <Text style={styles.emptyText}>Searching...</Text>
                          )}
                          {!isSearchingStops && subwaySearchResults.length === 0 && (
                            <Text style={styles.emptyText}>
                              {subwaySearchQuery.trim()
                                ? 'No stations found'
                                : 'Type to search stations'}
                            </Text>
                          )}
                          {subwaySearchResults.map(option => (
                            <Pressable
                              key={option.stopId}
                              style={({pressed}) => [
                                styles.stopItem,
                                option.stopId === sel?.stopId && styles.stopItemSelected,
                                pressed && styles.stopItemPressed,
                              ]}
                              onPress={() => chooseSubwayStop(option)}>
                              <Text style={styles.stopItemTitle}>{option.name}</Text>
                              <Text style={styles.stopItemSubtitle}>{option.stopId}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    </>
                  )}

                  {/* Direction picker */}
                  {!!sel?.stopId && (
                    <>
                      <Text style={styles.hintText}>Direction</Text>
                      <View style={styles.lineGrid}>
                        {(['N', 'S'] as const).map(dir => (
                          <Pressable
                            key={dir}
                            style={[
                              styles.lineChip,
                              sel.direction === dir && styles.lineChipActive,
                            ]}
                            onPress={() =>
                              setSubwaySelections(prev => {
                                const next = [...prev];
                                if (!next[index]) return prev;
                                next[index] = {...next[index], direction: dir};
                                return next;
                              })
                            }>
                            <Text
                              style={[
                                styles.lineChipText,
                                sel.direction === dir && styles.lineChipTextActive,
                              ]}>
                              {dir === 'N' ? 'Northbound' : 'Southbound'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Line chips */}
                  {!!sel?.stopId && (
                    <>
                      <Text style={styles.hintText}>Line</Text>
                      {subwayLoadingLines[index] && (
                        <Text style={styles.hintText}>Loading lines...</Text>
                      )}
                      {!subwayLoadingLines[index] &&
                        (subwayAvailableLines[index]?.length ?? 0) === 0 && (
                          <Text style={styles.hintText}>No lines for this stop.</Text>
                        )}
                      <View style={styles.lineGrid}>
                        {(subwayAvailableLines[index] ?? []).map(line => (
                          <Pressable
                            key={`${index}-${line.id}`}
                            style={[
                              styles.lineChip,
                              sel.line === line.id && styles.lineChipActive,
                            ]}
                            onPress={() =>
                              setSubwaySelections(prev => {
                                const next = [...prev];
                                if (!next[index]) return prev;
                                next[index] = {...next[index], line: line.id};
                                return next;
                              })
                            }>
                            <Text
                              style={[
                                styles.lineChipText,
                                sel.line === line.id && styles.lineChipTextActive,
                              ]}>
                              {line.id}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Remove Train 2 */}
                  {isSecond && (
                    <Pressable
                      style={[styles.stationSelector, {marginTop: spacing.xs}]}
                      onPress={() => {
                        setSubwaySelections(prev => prev.slice(0, 1));
                        setSubwayAvailableLines(prev => [prev[0] ?? [], []]);
                        setSubwayLoadingLines(prev => [prev[0] ?? false, false]);
                        setActiveSelectionIndex(0);
                        setSubwayStopDropdownOpen(false);
                      }}>
                      <Text style={[styles.stationSelectorText, {color: colors.warning}]}>
                        Remove Train 2
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
>>>>>>> Stashed changes
          </>
        )}

        {/* Summary */}
        <Text style={styles.destFixed}>
          {isBusMode
            ? `Selected: ${busSelectedLine ? `${busSelectedLine} @ ${busStopName}` : 'None'}`
            : `Selected: ${
                subwaySelections
                  .filter(s => s.line && s.stopId)
                  .map(s => `${s.line}@${s.stopId}${s.direction}`)
                  .join(', ') || 'None'
              }`}
        </Text>

        <Pressable style={styles.saveButton} onPress={saveConfig} disabled={isSaving}>
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
    padding: spacing.sm,
    color: colors.text,
    marginBottom: spacing.sm,
    fontSize: 12,
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
  selectionBlock: {marginBottom: spacing.xs},
  lineGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm},
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
  destFixed: {color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm},
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
