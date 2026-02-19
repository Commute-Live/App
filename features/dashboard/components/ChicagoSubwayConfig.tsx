import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {colors, radii, spacing} from '../../../theme';
import {apiFetch} from '../../../lib/api';

const CTA_DEFAULT_STOP_ID = '40380';
const CTA_DEFAULT_STOP_NAME = 'Clark/Lake';
const MAX_SELECTED_LINES = 2;

type StopOption = {stopId: string; stop: string; direction: ''};

type Props = {
  deviceId: string;
};

export default function ChicagoSubwayConfig({deviceId}: Props) {
  const [stops, setStops] = useState<StopOption[]>([]);
  const [isLoadingStops, setIsLoadingStops] = useState(false);
  const [stopsError, setStopsError] = useState('');
  const [selectedLines, setSelectedLines] = useState<string[]>(['BLUE']);
  const [stopId, setStopId] = useState(CTA_DEFAULT_STOP_ID);
  const [stopName, setStopName] = useState(CTA_DEFAULT_STOP_NAME);
  const [availableLines, setAvailableLines] = useState<string[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [stopDropdownOpen, setStopDropdownOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      if (!cancelled) {
        setIsLoadingStops(true);
        setStopsError('');
      }
      try {
        const stopsResponse = await apiFetch('/providers/chicago/stops/subway?limit=1000');
        console.log('[CTA stops] request', {status: stopsResponse.status, ok: stopsResponse.ok});

        if (cancelled) return;

        if (stopsResponse.ok) {
          const data = await stopsResponse.json();
          console.log('[CTA stops] response', {
            count: Array.isArray(data?.stops) ? data.stops.length : -1,
            sample: Array.isArray(data?.stops) ? data.stops.slice(0, 2) : data,
          });
          const nextStops: StopOption[] = Array.isArray(data?.stops)
            ? data.stops
                .map((item: any) => ({
                  stopId: typeof item?.stopId === 'string' ? item.stopId : '',
                  stop: typeof item?.stop === 'string' ? item.stop : '',
                  direction: '',
                }))
                .filter((item: StopOption) => item.stopId.length > 0 && item.stop.length > 0)
            : [];

          setStops(nextStops);
          const hasCurrentStop = nextStops.some((item: StopOption) => item.stopId.toUpperCase() === stopId.toUpperCase());
          if (!hasCurrentStop && nextStops.length > 0) {
            setStopId(nextStops[0].stopId);
            setStopName(nextStops[0].stop);
          }
        } else {
          setStopsError('Failed to load CTA stations');
        }
      } catch {
        console.log('[CTA stops] error');
        if (!cancelled) setStopsError('Failed to load CTA stations');
      } finally {
        if (!cancelled) setIsLoadingStops(false);
      }
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      try {
        const response = await apiFetch(`/device/${deviceId}/config`);
        if (!response.ok) return;

        const data = await response.json();
        const firstProvider = typeof data?.config?.lines?.[0]?.provider === 'string' ? data.config.lines[0].provider : '';
        if (firstProvider !== 'cta-subway') return;

        const configuredLines = Array.isArray(data?.config?.lines)
          ? data.config.lines
              .map((line: any) => (typeof line?.line === 'string' ? line.line.toUpperCase() : ''))
              .filter((line: string) => line.length > 0)
          : [];
        const firstStopId = typeof data?.config?.lines?.[0]?.stop === 'string' ? data.config.lines[0].stop.toUpperCase() : '';

        if (!cancelled && firstStopId.length > 0) {
          setStopId(firstStopId);
          const foundStop = stops.find(s => s.stopId.toUpperCase() === firstStopId);
          setStopName(foundStop?.stop ?? firstStopId);
        }

        if (!cancelled && configuredLines.length > 0) {
          setSelectedLines(configuredLines.slice(0, MAX_SELECTED_LINES));
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
    if (stops.length === 0) return;
    const found = stops.find(s => s.stopId.toUpperCase() === stopId.toUpperCase());
    if (found) {
      setStopName(found.stop);
    }
  }, [stopId, stops]);

  useEffect(() => {
    let cancelled = false;

    const loadLinesForStop = async () => {
      if (!stopId) return;
      if (!cancelled) {
        setIsLoadingLines(true);
        setAvailableLines([]);
      }
      try {
        const response = await apiFetch(`/providers/chicago/stops/${encodeURIComponent(stopId)}/lines`);
        console.log('[CTA lines] request', {stopId, status: response.status, ok: response.ok});
        if (!response.ok) {
          if (!cancelled) {
            setAvailableLines([]);
            setSelectedLines([]);
            setIsLoadingLines(false);
          }
          return;
        }

        const data = await response.json();
        console.log('[CTA lines] response', {
          stopId,
          lines: Array.isArray(data?.lines) ? data.lines : data,
        });
        const nextLines = Array.isArray(data?.lines)
          ? data.lines
              .map((line: unknown) => (typeof line === 'string' ? line.toUpperCase() : ''))
              .filter((line: string) => line.length > 0)
          : [];

        if (cancelled) return;
        setAvailableLines(nextLines);
        setSelectedLines(prev => {
          const filtered = prev.filter(line => nextLines.includes(line));
          if (filtered.length > 0) return filtered.slice(0, MAX_SELECTED_LINES);
          return nextLines.slice(0, MAX_SELECTED_LINES);
        });
        setIsLoadingLines(false);
      } catch {
        console.log('[CTA lines] error', {stopId});
        if (!cancelled) {
          setAvailableLines([]);
          setSelectedLines([]);
          setIsLoadingLines(false);
        }
      }
    };

    void loadLinesForStop();

    return () => {
      cancelled = true;
    };
  }, [stopId]);

  const chooseStop = useCallback((option: StopOption) => {
    setStopId(option.stopId);
    setStopName(option.stop);
    setStopDropdownOpen(false);
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

  const saveConfig = useCallback(async () => {
    if (!deviceId) return;
    setIsSaving(true);
    setStatusText('');

    if (selectedLines.length === 0) {
      setStatusText('Select at least one line');
      setIsSaving(false);
      return;
    }

    try {
      const configResponse = await apiFetch(`/device/${deviceId}/config`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          lines: selectedLines.map(line => ({
            provider: 'cta-subway',
            line,
            stop: stopId,
          })),
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
      setStatusText(`Updated ${selectedLines.join(', ')} at ${stopName} (${stopId})`);
    } catch {
      setStatusText('Network error');
    } finally {
      setIsSaving(false);
    }
  }, [deviceId, selectedLines, stopId, stopName]);

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

  return (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Chicago Station</Text>
        <Pressable
          style={({pressed}) => [
            styles.stationSelector,
            stopDropdownOpen && styles.stationSelectorOpen,
            pressed && styles.stationSelectorPressed,
          ]}
          onPress={() => setStopDropdownOpen(prev => !prev)}>
          <Text style={styles.stationSelectorText}>
            {stopName} ({stopId})
          </Text>
          <Text style={styles.stationSelectorCaret}>{stopDropdownOpen ? '▲' : '▼'}</Text>
        </Pressable>

        {isLoadingStops && <Text style={styles.hintText}>Loading CTA stations...</Text>}
        {!!stopsError && <Text style={styles.hintText}>{stopsError}</Text>}

        {stopDropdownOpen && (
          <View style={styles.stopList}>
            <ScrollView style={styles.stopListScroll} nestedScrollEnabled>
              {stops.length === 0 && !isLoadingStops && (
                <Text style={styles.emptyText}>No stations available.</Text>
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
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Chicago Trains</Text>
        <Text style={styles.hintText}>Select up to 2 lines for {stopId}.</Text>
        <Text style={styles.destFixed}>Selected: {selectedLines.join(', ') || 'None'}</Text>

        {isLoadingLines && <Text style={styles.hintText}>Loading lines...</Text>}
        {!isLoadingLines && availableLines.length === 0 && <Text style={styles.hintText}>No lines available.</Text>}
        <View style={styles.lineGrid}>{lineButtons}</View>

        <Pressable style={styles.saveButton} onPress={saveConfig} disabled={isSaving || isLoadingLines}>
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
