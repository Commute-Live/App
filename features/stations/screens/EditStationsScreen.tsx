import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useQuery} from '@tanstack/react-query';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {colors, radii, spacing} from '../../../theme';
import {useAppState} from '../../../state/appState';
import {CITY_LABELS, CITY_OPTIONS, type CityId} from '../../../constants/cities';
import {getTransitStations} from '../../../lib/transitApi';
import {queryKeys} from '../../../lib/queryKeys';
import type {TransitUiMode} from '../../../types/transit';

type StationSearchResult = {
  id: string;
  name: string;
  area: string;
};

const SUPPORTED_LIVE_CITIES: CityId[] = ['new-york', 'philadelphia', 'boston', 'chicago'];

export default function EditStationsScreen() {
  const {state, addStation, removeStation} = useAppState();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const selectedCity = state.selectedCity;
  const selectedCityOption = CITY_OPTIONS.find(option => option.id === selectedCity) ?? CITY_OPTIONS[0];
  const liveSupported = SUPPORTED_LIVE_CITIES.includes(selectedCity);
  const trimmedQuery = query.trim();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmedQuery);
    }, 220);
    return () => {
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  const liveStationsQuery = useQuery({
    queryKey: queryKeys.liveStationsSearch(selectedCity, debouncedQuery),
    queryFn: () => fetchLiveStations(selectedCity, debouncedQuery),
    enabled: liveSupported,
    retry: false,
  });

  const results = liveStationsQuery.data?.slice(0, 12) ?? [];
  const loading = liveStationsQuery.isPending || liveStationsQuery.isFetching;
  const error = liveStationsQuery.isError ? 'Unable to load stations right now.' : '';

  const visibleResults = useMemo(
    () => results.filter(item => !state.selectedStations.includes(item.name)).slice(0, 6),
    [results, state.selectedStations],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Edit Stations" />

        <View style={styles.section}>
          <Text style={styles.label}>City / Provider</Text>
          <Text style={styles.value}>{CITY_LABELS[selectedCity]} • {selectedCityOption.agencyName}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Selected stations</Text>
          {state.selectedStations.map(station => (
            <View key={station} style={styles.selectedRow}>
              <Text style={styles.selectedText}>{station}</Text>
              <Pressable onPress={() => removeStation(station)} style={styles.removeBtn}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
          {state.selectedStations.length === 0 && (
            <Text style={styles.empty}>No stations yet. Add one below.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Search & add</Text>
          {liveSupported ? (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search station name"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              {loading ? <Text style={styles.empty}>Loading stations...</Text> : null}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {!loading && !error && visibleResults.length === 0 ? (
                <Text style={styles.empty}>
                  {trimmedQuery ? 'No matching stations found.' : 'Start typing to search nearby stations.'}
                </Text>
              ) : null}

              {visibleResults.map(station => (
                <Pressable key={station.id} style={styles.resultRow} onPress={() => addStation(station.name)}>
                  <View style={styles.resultTextWrap}>
                    <Text style={styles.resultText}>{station.name}</Text>
                    {station.area ? <Text style={styles.resultMeta}>{station.area}</Text> : null}
                  </View>
                  <Text style={styles.addText}>Add</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <View style={styles.unsupportedCard}>
              <Text style={styles.empty}>Live station search is not yet available for this city.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function fetchLiveStations(city: CityId, query: string): Promise<StationSearchResult[]> {
  const modes = getModesForCity(city);
  const groups = await Promise.all(
    modes.map(mode => getTransitStations(city, mode).catch(() => null)),
  );

  const rows = groups.flatMap(group => group?.stations ?? []);
  const seen = new Set<string>();
  const normalized: StationSearchResult[] = [];

  for (const row of rows) {
    const station = normalizeStation(row);
    if (!station) continue;
    if (seen.has(station.id)) continue;
    seen.add(station.id);
    normalized.push(station);
  }

  const loweredQuery = query.trim().toLowerCase();
  const filtered = loweredQuery
    ? normalized.filter(station => station.name.toLowerCase().includes(loweredQuery))
    : normalized;

  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}

function getModesForCity(city: CityId): TransitUiMode[] {
  if (city === 'new-york') return ['train', 'bus', 'lirr'];
  if (city === 'philadelphia') return ['train', 'bus', 'trolley'];
  if (city === 'boston') return ['train', 'bus', 'commuter-rail', 'ferry'];
  if (city === 'chicago') return ['train', 'bus'];
  return ['train'];
}

function normalizeStation(row: {id: string; name: string; area: string | null}): StationSearchResult | null {
  if (!row.id || !row.name) return null;
  return {id: row.id, name: row.name, area: row.area ?? ''};
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg},
  section: {marginBottom: spacing.lg},
  label: {color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm},
  value: {color: colors.text, fontSize: 15, fontWeight: '600'},
  selectedRow: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectedText: {color: colors.text, flex: 1, fontWeight: '700'},
  removeBtn: {paddingHorizontal: spacing.sm, paddingVertical: spacing.xs},
  removeText: {color: colors.textMuted, fontSize: 13},
  empty: {color: colors.textMuted, fontSize: 13},
  input: {
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  unsupportedCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0F13',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  resultTextWrap: {flex: 1},
  resultText: {color: colors.text, fontWeight: '700'},
  resultMeta: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  addText: {color: colors.accent, fontWeight: '700'},
  errorText: {color: '#FCA5A5', fontSize: 13},
});
