import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {colors, radii, spacing} from '../../../theme';

const API_BASE = 'https://api.commutelive.com';
const CTA_DEFAULT_STOP_ID = '40380';
const CTA_DEFAULT_STOP_NAME = 'Clark/Lake';
const MAX_SELECTED_LINES = 2;

type StopOption = {stopId: string; stop: string; direction: ''};

type Props = {
  deviceId: string;
};

export default function ChicagoSubwayConfig({deviceId}: Props) {
  const [stops, setStops] = useState<StopOption[]>([]);
  const [selectedLines, setSelectedLines] = useState<string[]>(['BLUE']);
  const [stopId, setStopId] = useState(CTA_DEFAULT_STOP_ID);
  const [stopName, setStopName] = useState(CTA_DEFAULT_STOP_NAME);
  const [availableLines, setAvailableLines] = useState<string[]>(['RED', 'BLUE']);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [stopQuery, setStopQuery] = useState('');

  const filteredStops = useMemo(() => {
    const q = stopQuery.trim().toLowerCase();
    if (!q) return stops;
    return stops.filter(option => option.stop.toLowerCase().includes(q) || option.stopId.toLowerCase().includes(q));
  }, [stops, stopQuery]);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      try {
        const stopsResponse = await fetch(`${API_BASE}/providers/chicago/stops/subway?limit=1000`);

        if (cancelled) return;

        if (stopsResponse.ok) {
          const data = await stopsResponse.json();
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
        }
      } catch {
        // Keep defaults if options endpoint fails.
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
        const response = await fetch(`${API_BASE}/device/${deviceId}/config`);
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
      try {
        const response = await fetch(`${API_BASE}/providers/chicago/stops/${encodeURIComponent(stopId)}/lines`);
        if (!response.ok) {
          if (!cancelled) {
            setAvailableLines([]);
          }
          return;
        }

        const data = await response.json();
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
      } catch {
        if (!cancelled) {
          setAvailableLines([]);
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
      const configResponse = await fetch(`${API_BASE}/device/${deviceId}/config`, {
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
        setStatusText('Failed to save line');
        return;
      }

      await fetch(`${API_BASE}/refresh/device/${deviceId}`, {method: 'POST'});
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
          disabled={isSaving}>
          <Text style={[styles.lineChipText, selectedLines.includes(line) && styles.lineChipTextActive]}>{line}</Text>
        </Pressable>
      )),
    [availableLines, selectedLines, toggleLine, isSaving],
  );

  return (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Chicago Station</Text>
        <Text style={styles.hintText}>Choose a CTA station (from GTFS data):</Text>
        <TextInput
          value={stopQuery}
          onChangeText={setStopQuery}
          placeholder="Search CTA station"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <View style={styles.stopList}>
          <ScrollView style={styles.stopListScroll} nestedScrollEnabled>
            {filteredStops.map(option => {
              const isSelected = option.stopId.toUpperCase() === stopId.toUpperCase();
              return (
                <Pressable
                  key={option.stopId}
                  style={({pressed}) => [styles.stopItem, isSelected && styles.stopItemSelected, pressed && styles.stopItemPressed]}
                  onPress={() => chooseStop(option)}>
                  <Text style={styles.stopItemTitle}>{option.stop}</Text>
                  <Text style={styles.stopItemSubtitle}>{option.stopId}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Chicago Trains</Text>
        <Text style={styles.hintText}>Select up to 2 lines for {stopId}.</Text>
        <Text style={styles.destFixed}>Selected: {selectedLines.join(', ') || 'None'}</Text>

        {availableLines.length === 0 && <Text style={styles.hintText}>No lines available.</Text>}
        <View style={styles.lineGrid}>{lineButtons}</View>

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
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
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
