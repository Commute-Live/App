import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, radii, spacing} from '../../../theme';
type CityId = 'new-york' | 'philadelphia' | 'boston' | 'chicago';
type ModeId = 'train' | 'bus';
type Direction = 'uptown' | 'downtown';
type Station = {id: string; name: string; area: string; lines: string[]};
type Route = {id: string; label: string; color: string; textColor?: string};
type Arrival = {lineId: string; minutes: number; status: 'GOOD' | 'DELAYS'};
type LinePick = {id: string; mode: ModeId; stationId: string; routeId: string; direction: Direction};
type CityConfig = {
  recents: string[];
  modes: Partial<Record<ModeId, {stations: Station[]; routes: Route[]}>>;
};
const cityData: Record<CityId, CityConfig> = {
  'new-york': {
    recents: ['Times Sq - 42 St', 'Hoyt-Schermerhorn', '149 St-Grand Concourse'],
    modes: {
      train: {
        stations: [
          {id: 'tsq', name: 'Times Sq - 42 St', area: 'Manhattan', lines: ['N', 'Q', 'R', '1', '2', '3', '7']},
          {id: 'hoyt', name: 'Hoyt-Schermerhorn', area: 'Brooklyn', lines: ['A', 'C', 'G']},
          {id: '149', name: '149 St-Grand Concourse', area: 'Bronx', lines: ['2', '5', '4']},
        ],
        routes: [
          {id: '1', label: '1', color: '#EE352E'},
          {id: '2', label: '2', color: '#EE352E'},
          {id: '3', label: '3', color: '#EE352E'},
          {id: '4', label: '4', color: '#00933C'},
          {id: '5', label: '5', color: '#00933C'},
          {id: '6', label: '6', color: '#00933C'},
          {id: '7', label: '7', color: '#B933AD'},
          {id: 'A', label: 'A', color: '#0039A6'},
          {id: 'C', label: 'C', color: '#0039A6'},
          {id: 'E', label: 'E', color: '#0039A6'},
          {id: 'B', label: 'B', color: '#FF6319'},
          {id: 'D', label: 'D', color: '#FF6319'},
          {id: 'N', label: 'N', color: '#FCCC0A', textColor: '#0C0C0C'},
          {id: 'Q', label: 'Q', color: '#FCCC0A', textColor: '#0C0C0C'},
          {id: 'R', label: 'R', color: '#FCCC0A', textColor: '#0C0C0C'},
        ],
      },
      bus: {
        stations: [
          {id: 'm15', name: '1 Av & E 14 St', area: 'Manhattan', lines: ['M15', 'M15-SBS']},
          {id: 'bx12', name: 'Fordham Rd & Grand Concourse', area: 'Bronx', lines: ['Bx12', 'Bx12-SBS']},
        ],
        routes: [
          {id: 'M15', label: 'M15', color: '#00933C'},
          {id: 'M15-SBS', label: 'M15', color: '#00933C', textColor: '#0A0A0A'},
          {id: 'Bx12', label: 'Bx12', color: '#0039A6'},
          {id: 'Bx12-SBS', label: 'Bx12', color: '#0039A6', textColor: '#0A0A0A'},
        ],
      },
    },
  },
  philadelphia: {
    recents: ['30th Street', 'Suburban Station'],
    modes: {
      train: {
        stations: [
          {id: '30th', name: '30th Street Station', area: 'University City', lines: ['Trenton', 'Media', 'Airport']},
          {id: 'suburban', name: 'Suburban Station', area: 'Center City', lines: ['Warminster', 'Airport']},
        ],
        routes: [
          {id: 'TR', label: 'Tr', color: '#0061AA'},
          {id: 'ME', label: 'Me', color: '#FF8200'},
          {id: 'AP', label: 'Ap', color: '#009B3A'},
        ],
      },
      bus: {
        stations: [
          {id: '15', name: 'Girard & Front', area: 'Fishtown', lines: ['15', '5']},
          {id: '47', name: '8th & Market', area: 'Center City', lines: ['47', '47M']},
        ],
        routes: [
          {id: '15', label: '15', color: '#0061AA'},
          {id: '5', label: '5', color: '#009B3A'},
          {id: '47', label: '47', color: '#FF8200'},
          {id: '47M', label: '47M', color: '#9C27B0'},
        ],
      },
    },
  },
  boston: {
    recents: ['Downtown Crossing'],
    modes: {
      train: {
        stations: [
          {id: 'dc', name: 'Downtown Crossing', area: 'Boston', lines: ['Red', 'Orange']},
          {id: 'kenmore', name: 'Kenmore', area: 'Boston', lines: ['Green']},
        ],
        routes: [
          {id: 'Red', label: 'Red', color: '#DA291C'},
          {id: 'Orange', label: 'Org', color: '#ED8B00'},
          {id: 'Green', label: 'Grn', color: '#00843D'},
          {id: 'Blue', label: 'Blu', color: '#003DA5'},
        ],
      },
      bus: {
        stations: [{id: '1', name: 'Mass Ave @ Harvard Bridge', area: 'Cambridge', lines: ['1', 'CT1']}],
        routes: [
          {id: '1', label: '1', color: '#003DA5'},
          {id: 'CT1', label: 'CT1', color: '#DA291C'},
        ],
      },
    },
  },
  chicago: {
    recents: ['Clark/Lake', 'Fullerton'],
    modes: {
      train: {
        stations: [
          {id: 'clk', name: 'Clark/Lake', area: 'Loop', lines: ['Blue', 'Green', 'Orange', 'Pink']},
          {id: 'ful', name: 'Fullerton', area: 'Lincoln Park', lines: ['Red', 'Brown', 'Purple']},
        ],
        routes: [
          {id: 'Red', label: 'Red', color: '#C60C30'},
          {id: 'Blue', label: 'Blu', color: '#00A1DE'},
          {id: 'Green', label: 'Grn', color: '#009B3A'},
          {id: 'Brown', label: 'Brn', color: '#62361B'},
          {id: 'Orange', label: 'Org', color: '#F9461C'},
          {id: 'Purple', label: 'Pur', color: '#522398'},
          {id: 'Pink', label: 'Pnk', color: '#E27EA6'},
        ],
      },
    },
  },
};
const pixelGridSvg =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'><rect width='8' height='8' fill='%23000000'/><circle cx='1' cy='1' r='0.5' fill='%23111'/><circle cx='5' cy='3' r='0.5' fill='%23111'/><circle cx='3' cy='6' r='0.5' fill='%23111'/></svg>";

const mockDevices = [
  {id: 'CL-0412', name: 'CL-0412'},
  {id: 'CL-8821', name: 'Kitchen Display'},
];

const Haptics = {selectionAsync: async () => {}, notificationAsync: async (_: any) => {}};

export default function DashboardScreen() {
  const [city, setCity] = useState<CityId>('new-york');
  const [deviceId, setDeviceId] = useState<string>(mockDevices[0].id);
  const [lines, setLines] = useState<LinePick[]>(() => seedDefaultLines('new-york'));
  const [stationSearch, setStationSearch] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveDone, setSaveDone] = useState(false);

  const [arrivals, setArrivals] = useState<Arrival[]>(() => seedArrivals(lines));

  useEffect(() => {
    setArrivals(seedArrivals(lines));
  }, [lines]);

  useEffect(() => {
    const timer = setInterval(() => {
      setArrivals(prev => tickArrivals(prev));
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setLines(seedDefaultLines(city));
    setStationSearch({});
    void Haptics.selectionAsync();
  }, [city]);

  const snapshotRef = useRef({city, deviceId, lines});
  const isDirty = useMemo(() => {
    const snap = snapshotRef.current;
    return snap.city !== city || snap.deviceId !== deviceId || JSON.stringify(snap.lines) !== JSON.stringify(lines);
  }, [city, deviceId, lines]);

  const handleSave = () => {
    if (!isDirty || saving) return;
    setSaving(true);
    setSaveDone(false);
    setTimeout(() => {
      snapshotRef.current = {city, deviceId, lines};
      setSaving(false);
      setSaveDone(true);
      void Haptics.notificationAsync?.('success');
      setTimeout(() => setSaveDone(false), 1200);
    }, 1000);
  };

  const updateLine = (id: string, next: Partial<LinePick>) => {
    setLines(prev => prev.map(l => (l.id === id ? {...l, ...next} : l)));
  };

  const replaceLine = (id: string, line: LinePick) => {
    setLines(prev => prev.map(l => (l.id === id ? line : l)));
  };

  const removeLine = (id: string) => {
    setLines(prev => (prev.length === 1 ? prev : prev.filter(l => l.id !== id)));
  };

  const addLine = (mode: ModeId) => {
    const base = newLine(city, mode);
    setLines(prev => [...prev, {...base, id: `${Date.now()}`}]);
  };

  const moveLine = (id: string, dir: 'up' | 'down') => {
    setLines(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx === -1) return prev;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const currentStations = (mode: ModeId) => cityData[city].modes[mode]?.stations ?? [];
  const currentRoutes = (mode: ModeId) => cityData[city].modes[mode]?.routes ?? [];

  const cityRecents = cityData[city].recents;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TopBar
          deviceId={deviceId}
          onDeviceChange={setDeviceId}
          devices={mockDevices}
          city={city}
          onCityChange={setCity}
          cities={Object.keys(cityData) as CityId[]}
        />

        <LivePreviewCard lines={lines} city={city} arrivals={arrivals} />

        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionLabel}>Lines & Order</Text>
            <View style={styles.addRow}>
              <Pressable style={styles.addButton} onPress={() => addLine('train')}>
                <Text style={styles.addButtonText}>+ Add subway</Text>
              </Pressable>
              <Pressable style={styles.addButton} onPress={() => addLine('bus')}>
                <Text style={styles.addButtonText}>+ Add bus</Text>
              </Pressable>
            </View>
          </View>

          {lines.map((line, idx) => {
            const stations = currentStations(line.mode);
            const routes = currentRoutes(line.mode);
            const selectedStation = stations.find(s => s.id === line.stationId) ?? stations[0];
            const allowedRoutes = selectedStation ? routes.filter(r => selectedStation.lines.includes(r.id)) : routes;
            const safeRouteId = allowedRoutes.find(r => r.id === line.routeId)?.id ?? allowedRoutes[0]?.id ?? '';
            if (safeRouteId && safeRouteId !== line.routeId) {
              replaceLine(line.id, {...line, routeId: safeRouteId});
            }

            return (
              <LineCard
                key={line.id}
                line={line}
                index={idx}
                total={lines.length}
                stations={stations}
                routes={allowedRoutes}
                stationSearch={stationSearch[line.id] ?? ''}
                onStationSearch={text => setStationSearch(prev => ({...prev, [line.id]: text}))}
                recents={cityRecents}
                onChange={updateLine}
                onMoveUp={() => moveLine(line.id, 'up')}
                onMoveDown={() => moveLine(line.id, 'down')}
                onRemove={() => removeLine(line.id)}
                modeLabel={line.mode === 'train' ? 'Train' : 'Bus'}
              />
            );
          })}
          {lines.length === 0 ? (
            <Text style={styles.emptyHint}>Add a train or bus line using the tabs above.</Text>
          ) : null}
        </View>
      </ScrollView>

      <SaveBar dirty={isDirty} loading={saving} success={saveDone} onPress={handleSave} />
    </SafeAreaView>
  );
}
function TopBar({
  deviceId,
  onDeviceChange,
  devices,
  city,
  onCityChange,
  cities,
}: {
  deviceId: string;
  onDeviceChange: (id: string) => void;
  devices: {id: string; name: string}[];
  city: CityId;
  onCityChange: (c: CityId) => void;
  cities: CityId[];
}) {
  const [openCity, setOpenCity] = useState(false);
  const [openDevice, setOpenDevice] = useState(false);
  return (
    <>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.label}>Your Device</Text>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
        <View style={styles.topBarActions}>
          <Pressable style={styles.devicePill} onPress={() => setOpenDevice(true)}>
            <Text style={styles.cityPillText}>{devices.find(d => d.id === deviceId)?.name ?? deviceId} ▾</Text>
          </Pressable>
          <Pressable style={styles.cityPill} onPress={() => setOpenCity(true)}>
            <Text style={styles.cityPillText}>{cityLabel(city)} ▾</Text>
          </Pressable>
        </View>
      </View>

      <SimplePicker
        visible={openCity}
        options={cities.map(c => ({id: c, label: cityLabel(c)}))}
        value={city}
        onSelect={val => {
          onCityChange(val as CityId);
          setOpenCity(false);
        }}
        onClose={() => setOpenCity(false)}
      />

      <SimplePicker
        visible={openDevice}
        options={devices.map(d => ({id: d.id, label: d.name}))}
        value={deviceId}
        onSelect={val => {
          onDeviceChange(val);
          setOpenDevice(false);
        }}
        onClose={() => setOpenDevice(false)}
      />
    </>
  );
}
function LivePreviewCard({lines, city, arrivals}: {lines: LinePick[]; city: CityId; arrivals: Arrival[]}) {
  const cityRoutes = (mode: ModeId) => cityData[city].modes[mode]?.routes ?? [];
  return (
    <View style={styles.previewWrapper}>
      <ImageBackground source={{uri: pixelGridSvg}} style={styles.previewCard} imageStyle={{opacity: 0.22}}>
        <View style={styles.previewHeaderRow}>
          <Text style={styles.previewStation}>Live Preview</Text>
          <View style={[styles.statusPill, styles.statusGood]}>
            <View style={styles.statusDotLarge} />
            <Text style={styles.statusPillText}>GOOD</Text>
          </View>
        </View>
        <View style={styles.previewList}>
          {lines.map(line => {
            const stations = cityData[city].modes[line.mode]?.stations ?? [];
            const station = stations.find(s => s.id === line.stationId);
            const routes = cityRoutes(line.mode);
            const route = routes.find(r => r.id === line.routeId);
            const arrival = arrivals.find(a => a.lineId === line.id);
            return (
              <View key={line.id} style={styles.previewRow}>
                <View style={[styles.routeBadge, {backgroundColor: route?.color ?? '#444', minWidth: 54}]}>
                  <Text style={[styles.routeBadgeText, {color: route?.textColor ?? '#fff'}]}>{route?.label ?? '?'}</Text>
                  <Text style={styles.routeDir}>{line.direction === 'uptown' ? 'UP' : 'DOWN'}</Text>
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.previewStationName} numberOfLines={1}>
                    {station?.name ?? 'Pick station'}
                  </Text>
                  <Text style={styles.previewArea}>{station?.area ?? '-'}</Text>
                </View>
                <View style={styles.arrivalPill}>
                  <Text style={styles.arrivalTime}>{arrival?.minutes ?? 3}m</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ImageBackground>
    </View>
  );
}
function LineCard({
  line,
  index,
  total,
  stations,
  routes,
  modeLabel,
  stationSearch,
  onStationSearch,
  recents,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  line: LinePick;
  index: number;
  total: number;
  stations: Station[];
  routes: Route[];
  modeLabel: string;
  stationSearch: string;
  onStationSearch: (t: string) => void;
  recents: string[];
  onChange: (id: string, next: Partial<LinePick>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.lineCard}>
      <View style={styles.lineHeader}>
        <Text style={styles.lineTitle}>Line {index + 1}</Text>
        <View style={styles.modePill}>
          <Text style={styles.modePillText}>{modeLabel}</Text>
        </View>
        <View style={styles.lineActions}>
          <Pressable disabled={index === 0} onPress={onMoveUp} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>{'^'}</Text>
          </Pressable>
          <Pressable disabled={index === total - 1} onPress={onMoveDown} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>{'v'}</Text>
          </Pressable>
          {total > 1 && (
            <Pressable onPress={onRemove} style={[styles.iconButton, {marginLeft: 6}]}>
              <Text style={styles.iconButtonText}>{'x'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <StationInlinePicker
        stations={stations}
        value={line.stationId}
        search={stationSearch}
        onSearch={onStationSearch}
        recents={recents}
        onSelect={id => onChange(line.id, {stationId: id})}
      />

      <RouteGridPicker
        routes={routes}
        selected={line.routeId ? [line.routeId] : []}
        onToggle={id => onChange(line.id, {routeId: id})}
        single
      />

      <DirectionToggle value={line.direction} onChange={dir => onChange(line.id, {direction: dir})} />
    </View>
  );
}
function RouteGridPicker({
  routes,
  selected,
  onToggle,
  single = false,
}: {
  routes: Route[];
  selected: string[];
  onToggle: (id: string) => void;
  single?: boolean;
}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionLabel}>Route</Text>
      <View style={styles.routeGrid}>
        {routes.map(route => {
          const active = selected.includes(route.id);
          return (
            <Pressable
              key={route.id}
              style={[styles.routeTile, {borderColor: active ? colors.accent : colors.border}]}
              onPress={() => onToggle(single ? route.id : route.id)}>
              <View style={[styles.routeCircle, {backgroundColor: route.color}]}>
                <Text style={[styles.routeCircleText, {color: route.textColor ?? '#fff'}]}>{route.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function StationInlinePicker({
  stations,
  value,
  search,
  onSearch,
  recents,
  onSelect,
}: {
  stations: Station[];
  value: string;
  search: string;
  onSearch: (t: string) => void;
  recents: string[];
  onSelect: (id: string) => void;
}) {
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return stations;
    return stations.filter(
      s =>
        s.name.toLowerCase().includes(term) ||
        s.area.toLowerCase().includes(term) ||
        s.lines.join(' ').toLowerCase().includes(term),
    );
  }, [search, stations]);

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionLabel}>Station</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentsRow}>
        {recents.map(r => (
          <Pressable key={r} style={styles.recentChip} onPress={() => onSelectByName(r, stations, onSelect)}>
            <Text style={styles.recentChipText}>{r}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <TextInput
        value={search}
        onChangeText={onSearch}
        placeholder="Search station"
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
      />
      <View style={styles.stationListInline}>
        {filtered.map((item, idx) => (
          <React.Fragment key={item.id}>
            <Pressable style={styles.stationRow} onPress={() => onSelect(item.id)}>
              <View>
                <Text style={styles.stationName}>{item.name}</Text>
                <Text style={styles.stationMeta}>
                  {item.area} - {item.lines.join(' / ')}
                </Text>
              </View>
              <Text style={styles.chevron}>{value === item.id ? 'OK' : '>'}</Text>
            </Pressable>
            {idx < filtered.length - 1 && <View style={styles.listDivider} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function DirectionToggle({value, onChange}: {value: Direction; onChange: (d: Direction) => void}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionLabel}>Direction</Text>
      <View style={styles.segmented}>
        {(['uptown', 'downtown'] as Direction[]).map(dir => {
          const active = dir === value;
          return (
            <Pressable key={dir} style={[styles.segment, active && styles.segmentActive]} onPress={() => onChange(dir)}>
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {dir === 'uptown' ? 'Uptown / North' : 'Downtown / South'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
function SaveBar({dirty, loading, success, onPress}: {dirty: boolean; loading: boolean; success: boolean; onPress: () => void}) {
  return (
    <View style={styles.saveBar}>
      <Pressable
        disabled={!dirty || loading}
        onPress={onPress}
        style={[styles.saveButton, (!dirty || loading) && styles.saveButtonDisabled, success && styles.saveButtonSuccess]}>
        <Text style={styles.saveButtonText}>{loading ? 'Saving...' : success ? 'Synced' : 'Save to Device'}</Text>
      </Pressable>
      <Text style={styles.saveHint}>{success ? 'Last synced just now' : dirty ? 'Unsaved changes' : 'No changes'}</Text>
    </View>
  );
}
function SimplePicker({
  visible,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  options: {id: string; label: string}[];
  value: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalSheet}>
          {options.map(opt => (
            <Pressable
              key={opt.id}
              style={[styles.modalOption, opt.id === value && styles.modalOptionActive]}
              onPress={() => onSelect(opt.id)}>
              <Text style={[styles.modalOptionText, opt.id === value && styles.modalOptionTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
function cityLabel(id: CityId) {
  switch (id) {
    case 'new-york':
      return 'New York';
    case 'philadelphia':
      return 'Philly';
    case 'boston':
      return 'Boston';
    case 'chicago':
      return 'Chicago';
  }
}

function newLine(city: CityId, mode: ModeId = 'train'): LinePick {
  const stations = cityData[city].modes[mode]?.stations ?? [];
  const routes = cityData[city].modes[mode]?.routes ?? [];
  const firstStation = stations[0];
  const firstRoute = firstStation ? routes.find(r => firstStation.lines.includes(r.id)) : routes[0];
  return {
    id: `${Date.now()}`,
    mode,
    stationId: firstStation?.id ?? '',
    routeId: firstRoute?.id ?? '',
    direction: 'uptown',
  };
}

function seedDefaultLines(city: CityId): LinePick[] {
  const lines: LinePick[] = [];
  const stations = cityData[city].modes.train?.stations ?? [];
  const routes = cityData[city].modes.train?.routes ?? [];
  const firstStation = stations[0];
  const secondStation = stations[1] ?? stations[0];
  const r2 = routes.find(r => secondStation?.lines.includes(r.id));
  const r1 = routes.find(r => firstStation?.lines.includes(r.id));
  lines.push({
    id: 'line-1',
    mode: 'train',
    stationId: firstStation?.id ?? '',
    routeId: r1?.id ?? '',
    direction: 'uptown',
  });
  // leave only one default line to reduce clutter; user can add bus or train via tabs
  return lines;
}

function seedArrivals(lines: LinePick[]): Arrival[] {
  return lines.map(l => ({
    lineId: l.id,
    minutes: 2 + Math.floor(Math.random() * 8),
    status: Math.random() > 0.85 ? 'DELAYS' : 'GOOD',
  }));
}

function tickArrivals(prev: Arrival[]): Arrival[] {
  return prev.map(a => {
    const next = Math.max(0, a.minutes - (Math.random() > 0.4 ? 1 : 0));
    const recycled = next === 0 ? 8 + Math.floor(Math.random() * 4) : next;
    const status = Math.random() > 0.9 ? 'DELAYS' : 'GOOD';
    return {...a, minutes: recycled, status};
  });
}

function onSelectByName(name: string, stations: Station[], onSelect: (id: string) => void) {
  const found = stations.find(s => s.name === name);
  if (found) onSelect(found.id);
}
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {padding: spacing.lg, paddingBottom: 140},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  topBarLeft: {flexDirection: 'row', alignItems: 'center', gap: 6},
  topBarActions: {flexDirection: 'row', gap: spacing.xs},
  label: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  onlineDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success},
  onlineText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  cityPill: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  devicePill: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  cityPillText: {color: colors.text, fontSize: 12, fontWeight: '800'},
  modalOverlay: {flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-start', paddingTop: 72},
  modalSheet: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOption: {padding: spacing.md},
  modalOptionActive: {backgroundColor: colors.accentMuted},
  modalOptionText: {color: colors.text, fontSize: 15, fontWeight: '700'},
  modalOptionTextActive: {color: colors.accent},
  previewWrapper: {marginBottom: spacing.md},
  previewCard: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0F131A',
    backgroundColor: '#020204',
    padding: spacing.md,
    minHeight: 180,
  },
  previewHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  previewStation: {color: '#E9F5FF', fontSize: 18, fontWeight: '900', flex: 1, marginRight: spacing.sm},
  previewArea: {color: '#7A8699', fontSize: 12},
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.md,
  },
  statusGood: {backgroundColor: '#0B3B2E'},
  statusDotLarge: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#5CE1E6'},
  statusPillText: {color: '#fff', fontWeight: '800', fontSize: 11},
  previewList: {marginTop: spacing.sm, gap: spacing.sm},
  previewRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  previewStationName: {color: '#E9ECEF', fontSize: 14, fontWeight: '800'},
  arrivalPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  arrivalTime: {color: colors.text, fontSize: 18, fontWeight: '900'},
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  addRow: {flexDirection: 'row', gap: spacing.xs},
  addButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  addButtonText: {color: colors.text, fontWeight: '800'},
  lineCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  lineHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  lineTitle: {color: colors.text, fontWeight: '800'},
  lineActions: {flexDirection: 'row', alignItems: 'center'},
  iconButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  iconButtonText: {color: colors.text},
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  segment: {flex: 1, paddingVertical: spacing.sm, alignItems: 'center'},
  segmentActive: {backgroundColor: colors.accentMuted},
  segmentText: {color: colors.textMuted, fontWeight: '700', fontSize: 13},
  segmentTextActive: {color: colors.accent},
  selector: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorLabel: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  selectorValue: {color: colors.text, fontSize: 14, fontWeight: '800'},
  sectionBlock: {gap: spacing.xs},
  sectionLabel: {color: colors.text, fontSize: 14, fontWeight: '800'},
  routeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  routeTile: {
    width: 70,
    height: 70,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  routeCircle: {width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center'},
  routeCircleText: {fontWeight: '900', fontSize: 18},
  routeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeBadgeText: {fontWeight: '900', fontSize: 16},
  routeDir: {color: '#E9ECEF', fontSize: 11, fontWeight: '700', opacity: 0.8},
  stationRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm},
  stationListInline: {maxHeight: 240},
  stationName: {color: colors.text, fontSize: 14, fontWeight: '800'},
  stationMeta: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  chevron: {color: colors.textMuted, fontSize: 18, fontWeight: '700'},
  listDivider: {height: 1, backgroundColor: colors.border},
  recentsRow: {flexGrow: 0, marginBottom: spacing.xs},
  recentChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  recentChipText: {color: colors.text, fontWeight: '700', fontSize: 12},
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {opacity: 0.4},
  saveButtonSuccess: {backgroundColor: colors.success},
  saveButtonText: {color: colors.background, fontWeight: '900', fontSize: 15},
  saveHint: {color: colors.textMuted, fontSize: 12, textAlign: 'center'},
  emptyHint: {color: colors.textMuted, fontSize: 12, marginTop: spacing.xs},
});
