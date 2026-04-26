import React, {useMemo, useState} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppBrandHeader} from '../../../components/AppBrandHeader';
import {TabScreen} from '../../../components/TabScreen';
import {useAuth} from '../../../state/authProvider';
import {useSelectedDevice} from '../../../hooks/useSelectedDevice';
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {DISPLAY_WEEKDAYS, type DisplayWeekday} from '../../../lib/schedules';

type ScheduleKind = 'commute' | 'fitness' | 'sleep' | 'weekend';

type ScheduleEntry = {
  id: string;
  title: string;
  detail: string;
  startHour: number;
  endHour: number;
  startLabel: string;
  endLabel: string;
  days: DisplayWeekday[];
  displayId: string | null;
  kind: ScheduleKind;
};

type SavedDisplay = {
  id: string;
  name: string;
  summary: string;
  window: string;
  accent: string;
  soft: string;
};

type DraftEntry = {
  title: string;
  detail: string;
  startLabel: string;
  endLabel: string;
  days: DisplayWeekday[];
  displayId: string | null;
  kind: ScheduleKind;
};

const DAY_LABELS: Record<DisplayWeekday, string> = {
  sun: 'Sun',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
};

const KIND_META: Record<
  ScheduleKind,
  {
    icon: keyof typeof Ionicons.glyphMap;
    chip: string;
    label: string;
    tint: string;
    soft: string;
  }
> = {
  commute: {
    icon: 'train-outline',
    chip: 'Commute',
    label: 'Work',
    tint: '#F47C20',
    soft: 'rgba(244,124,32,0.12)',
  },
  fitness: {
    icon: 'barbell-outline',
    chip: 'Workout',
    label: 'Gym',
    tint: '#2E8B57',
    soft: 'rgba(46,139,87,0.12)',
  },
  sleep: {
    icon: 'moon-outline',
    chip: 'Sleep',
    label: 'Sleep',
    tint: '#466C88',
    soft: 'rgba(70,108,136,0.14)',
  },
  weekend: {
    icon: 'school-outline',
    chip: 'Weekend',
    label: 'School',
    tint: '#4B67A8',
    soft: 'rgba(75,103,168,0.14)',
  },
};

const INITIAL_DRAFT: DraftEntry = {
  title: '',
  detail: '',
  startLabel: '07:00',
  endLabel: '09:00',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  displayId: 'display-1',
  kind: 'commute',
};

const SAVED_DISPLAYS: SavedDisplay[] = [
  {
    id: 'display-1',
    name: 'Morning commute board',
    summary: 'M15 Uptown with weekday arrivals',
    window: 'Best for 7:00 - 9:00',
    accent: '#F47C20',
    soft: 'rgba(244,124,32,0.12)',
  },
  {
    id: 'display-2',
    name: 'Gym route board',
    summary: '4 and 5 Downtown after work',
    window: 'Best for 6:00 - 7:00',
    accent: '#2E8B57',
    soft: 'rgba(46,139,87,0.12)',
  },
  {
    id: 'display-3',
    name: 'Weekend Brooklyn board',
    summary: 'N and Q service toward Brooklyn',
    window: 'Best for 9:00 - 11:00',
    accent: '#4B67A8',
    soft: 'rgba(75,103,168,0.14)',
  },
];

const parseTimeLabelToHour = (value: string) => {
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minutes = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minutes)) return null;
  if (hour < 0 || hour > 23 || minutes < 0 || minutes > 59) return null;
  return hour + minutes / 60;
};

const formatTimelineTime = (hour: number) => {
  if (hour === 0 || hour === 24) return '12 am';
  if (hour === 12) return '12 pm';
  if (hour < 12) return `${hour} am`;
  return `${hour - 12} pm`;
};

const getDaySummary = (days: DisplayWeekday[]) => {
  if (days.length === 7) return 'Every day';
  const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const isWeekdaySet =
    days.length === 5 && weekdays.every(day => days.includes(day as DisplayWeekday));
  if (isWeekdaySet) return 'Mon - Fri';
  if (days.length === 2 && days.includes('sat') && days.includes('sun')) return 'Sat & Sun';
  return days.map(day => DAY_LABELS[day]).join(', ');
};

const buildEntry = (draft: DraftEntry): ScheduleEntry | null => {
  const startHour = parseTimeLabelToHour(draft.startLabel);
  const endHour = parseTimeLabelToHour(draft.endLabel);
  if (startHour === null || endHour === null) return null;

  return {
    id: `${Date.now()}`,
    title: draft.title.trim() || 'Custom schedule',
    detail: draft.detail.trim() || 'Display switches automatically during this window.',
    startHour,
    endHour,
    startLabel: draft.startLabel,
    endLabel: draft.endLabel,
    days: draft.days,
    displayId: draft.displayId,
    kind: draft.kind,
  };
};

const INITIAL_ITEMS: ScheduleEntry[] = [
  {
    id: 'morning',
    title: 'Morning commute',
    detail: 'M15 to Uptown',
    startHour: 7,
    endHour: 9,
    startLabel: '07:00',
    endLabel: '09:00',
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    displayId: 'display-1',
    kind: 'commute',
  },
  {
    id: 'gym',
    title: 'Gym',
    detail: '4 and 5 downtown',
    startHour: 18,
    endHour: 19,
    startLabel: '18:00',
    endLabel: '19:00',
    days: ['mon', 'wed', 'fri'],
    displayId: 'display-2',
    kind: 'fitness',
  },
  {
    id: 'weekend',
    title: 'Tennis / Pickleball',
    detail: 'N and Q to Brooklyn',
    startHour: 9,
    endHour: 11,
    startLabel: '09:00',
    endLabel: '11:00',
    days: ['sat', 'sun'],
    displayId: 'display-3',
    kind: 'weekend',
  },
  {
    id: 'sleep',
    title: 'Sleep mode',
    detail: 'Display turns off completely',
    startHour: 22,
    endHour: 24,
    startLabel: '22:00',
    endLabel: '07:00',
    days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    displayId: null,
    kind: 'sleep',
  },
];

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const {user} = useAuth();
  const selectedDevice = useSelectedDevice();
  const isWide = width >= 1024;
  const [items, setItems] = useState<ScheduleEntry[]>(INITIAL_ITEMS);
  const [composerVisible, setComposerVisible] = useState(false);
  const [draft, setDraft] = useState<DraftEntry>(INITIAL_DRAFT);
  const savedDisplays = SAVED_DISPLAYS;
  const selectedDraftDisplay =
    savedDisplays.find(display => display.id === draft.displayId) ?? null;

  const timelineBlocks = useMemo(
    () =>
      items.map(item => {
        const meta = KIND_META[item.kind];
        const safeEnd = item.kind === 'sleep' && item.endHour < item.startHour ? 24 : item.endHour;
        const left = `${(item.startHour / 24) * 100}%` as `${number}%`;
        const widthPercent = `${(Math.max(safeEnd - item.startHour, 0.75) / 24) * 100}%` as `${number}%`;
        return {
          id: item.id,
          left,
          width: widthPercent,
          color: meta.tint,
        };
      }),
    [items],
  );

  const scheduleCountLabel = `${items.length} schedules`;

  const resetDraft = () => {
    setDraft(INITIAL_DRAFT);
  };

  const toggleDraftDay = (day: DisplayWeekday) => {
    setDraft(current => {
      const exists = current.days.includes(day);
      return {
        ...current,
        days: exists ? current.days.filter(value => value !== day) : [...current.days, day],
      };
    });
  };

  const handleSave = () => {
    const nextEntry = buildEntry(draft);
    if (!nextEntry) return;
    setItems(current =>
      [...current, nextEntry].sort((a, b) => {
        if (a.startHour !== b.startHour) return a.startHour - b.startHour;
        return a.title.localeCompare(b.title);
      }),
    );
    setComposerVisible(false);
    resetDraft();
  };

  return (
    <TabScreen style={[styles.container, {paddingTop: insets.top}]} tabRoute="/schedule">
      <AppBrandHeader email={user?.email} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isWide ? styles.scrollWide : null,
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.screenFrame}>
          <View style={[styles.card, isWide ? styles.cardWide : null]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderCopy}>
                <Text style={styles.cardTitle}>Today&apos;s Schedule</Text>
                <Text style={styles.cardSubtitle}>
                  {selectedDevice.name} · {scheduleCountLabel}
                </Text>
              </View>

              <View style={styles.cardActions}>
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add schedule"
                  onPress={() => setComposerVisible(true)}
                  style={({pressed}) => [styles.addButton, pressed && styles.addButtonPressed]}>
                  <Ionicons name="add" size={18} color={colors.onAccent} />
                </Pressable>
              </View>
            </View>

            <View style={styles.timelineSection}>
              <View style={styles.timelineTrack}>
                <View style={styles.timelineBase} />
                {timelineBlocks.map(block => (
                  <View
                    key={block.id}
                    style={[
                      styles.timelineBlock,
                      {
                        left: block.left,
                        width: block.width,
                        backgroundColor: block.color,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.timelineLabels}>
                {[0, 6, 12, 18, 24].map(hour => (
                  <Text key={hour} style={styles.timelineLabel}>
                    {formatTimelineTime(hour)}
                  </Text>
                ))}
              </View>
            </View>

            <View style={styles.list}>
              {items.map((item, index) => {
                const meta = KIND_META[item.kind];
                const savedDisplay =
                  item.displayId != null ? savedDisplays.find(display => display.id === item.displayId) ?? null : null;
                return (
                  <View
                    key={item.id}
                    style={[styles.listRow, index < items.length - 1 ? styles.listRowBorder : null]}>
                    <View style={[styles.listIconWrap, {backgroundColor: meta.soft}]}>
                      <Ionicons name={meta.icon} size={18} color={meta.tint} />
                    </View>

                    <View style={styles.listCopy}>
                      <View style={styles.listTitleRow}>
                        <Text style={styles.listTitle}>{item.title}</Text>
                        <View style={[styles.typeChip, {borderColor: meta.tint + '55', backgroundColor: meta.soft}]}>
                          <Text style={[styles.typeChipText, {color: meta.tint}]}>{getDaySummary(item.days)}</Text>
                        </View>
                      </View>

                      {savedDisplay ? (
                        <View style={styles.routeRow}>
                          <View style={[styles.displayChip, {backgroundColor: savedDisplay.soft}]}>
                            <Text style={[styles.displayChipText, {color: savedDisplay.accent}]}>Saved display</Text>
                          </View>
                          <Text style={styles.routeMeta}>{savedDisplay.name}</Text>
                        </View>
                      ) : (
                        <Text style={styles.listDetail}>{item.detail}</Text>
                      )}
                    </View>

                    <View style={styles.timeWrap}>
                      <Text style={styles.timeText}>
                        {item.startLabel} - {item.endLabel}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={composerVisible}
        onRequestClose={() => {
          setComposerVisible(false);
          resetDraft();
        }}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setComposerVisible(false);
              resetDraft();
            }}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Schedule</Text>
                <Text style={styles.modalSubtitle}>Front-end only composer</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close add schedule"
                onPress={() => {
                  setComposerVisible(false);
                  resetDraft();
                }}
                style={({pressed}) => [styles.closeButton, pressed && styles.closeButtonPressed]}>
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  value={draft.title}
                  onChangeText={value => setDraft(current => ({...current, title: value}))}
                  placeholder="Morning commute"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                />
              </View>

              <View style={styles.formGrid}>
                <View style={styles.formSectionHalf}>
                  <Text style={styles.fieldLabel}>Start</Text>
                  <TextInput
                    value={draft.startLabel}
                    onChangeText={value => setDraft(current => ({...current, startLabel: value}))}
                    placeholder="07:00"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>
                <View style={styles.formSectionHalf}>
                  <Text style={styles.fieldLabel}>End</Text>
                  <TextInput
                    value={draft.endLabel}
                    onChangeText={value => setDraft(current => ({...current, endLabel: value}))}
                    placeholder="09:00"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>Icon</Text>
                <View style={styles.iconPickerRow}>
                  {(Object.keys(KIND_META) as ScheduleKind[]).map(kind => {
                    const selected = draft.kind === kind;
                    const meta = KIND_META[kind];
                    return (
                      <Pressable
                        key={kind}
                        onPress={() => setDraft(current => ({...current, kind}))}
                        style={({pressed}) => [
                          styles.iconPickerCard,
                          selected ? {borderColor: meta.tint, backgroundColor: meta.soft} : null,
                          pressed && styles.iconPickerCardPressed,
                        ]}>
                        <View style={[styles.iconPickerGlyph, selected ? {backgroundColor: meta.soft} : null]}>
                          <Ionicons name={meta.icon} size={16} color={selected ? meta.tint : colors.textMuted} />
                        </View>
                        <Text style={[styles.iconPickerText, selected ? {color: meta.tint} : null]}>{meta.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>Days</Text>
                <View style={styles.pillRow}>
                  {DISPLAY_WEEKDAYS.map(day => {
                    const selected = draft.days.includes(day);
                    return (
                      <Pressable
                        key={day}
                        onPress={() => toggleDraftDay(day)}
                        style={({pressed}) => [
                          styles.pill,
                          selected ? styles.pillActive : null,
                          pressed && styles.pillPressed,
                        ]}>
                        <Text style={[styles.pillText, selected ? styles.pillTextActive : null]}>{DAY_LABELS[day]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>Saved display</Text>
                <View style={styles.displayPickerList}>
                  {savedDisplays.map(display => {
                    const selected = draft.displayId === display.id;
                    return (
                      <Pressable
                        key={display.id}
                        onPress={() => setDraft(current => ({...current, displayId: display.id}))}
                        style={({pressed}) => [
                          styles.displayPickerCard,
                          selected ? styles.displayPickerCardSelected : null,
                          pressed && styles.displayPickerCardPressed,
                        ]}>
                        <View style={[styles.displayPickerAccent, {backgroundColor: display.accent}]} />
                        <View style={styles.displayPickerCopy}>
                          <Text style={styles.displayPickerName}>{display.name}</Text>
                          <Text style={styles.displayPickerSummary}>{display.summary}</Text>
                          <Text style={styles.displayPickerWindow}>{display.window}</Text>
                        </View>
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={18}
                          color={selected ? colors.accent : colors.textTertiary}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {selectedDraftDisplay ? (
                <View style={styles.selectedDisplayPreview}>
                  <Text style={styles.selectedDisplayPreviewLabel}>Selected display</Text>
                  <Text style={styles.selectedDisplayPreviewTitle}>{selectedDraftDisplay.name}</Text>
                  <Text style={styles.selectedDisplayPreviewBody}>{selectedDraftDisplay.summary}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => {
                  setComposerVisible(false);
                  resetDraft();
                }}
                style={({pressed}) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={({pressed}) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
                <Text style={styles.primaryButtonText}>Add Schedule</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.screenPadding,
    paddingBottom: layout.bottomInset,
  },
  scrollWide: {
    justifyContent: 'center',
  },
  layout: {
    width: '100%',
    alignSelf: 'center',
  },
  screenFrame: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 12},
    elevation: 3,
  },
  cardWide: {
    flex: 1,
    maxWidth: 560,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  cardHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successSurface,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  activeBadgeText: {
    color: colors.successText,
    fontSize: 12,
    fontWeight: '700',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  addButtonPressed: {
    opacity: 0.88,
  },
  timelineSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  timelineTrack: {
    position: 'relative',
    height: 14,
    justifyContent: 'center',
  },
  timelineBase: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#D0D7DF',
  },
  timelineBlock: {
    position: 'absolute',
    height: 12,
    borderRadius: 999,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  timelineLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCopy: {
    flex: 1,
    gap: 5,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  listTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  typeChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  lineChip: {
    minWidth: 24,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  lineChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  displayChip: {
    minHeight: 20,
    borderRadius: 6,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  displayChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  routeMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  listDetail: {
    color: colors.textMuted,
    fontSize: 13,
  },
  timeWrap: {
    minWidth: 88,
    alignItems: 'flex-end',
  },
  timeText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.titleLg,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  closeButtonPressed: {
    opacity: 0.88,
  },
  modalContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  formGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  formSection: {
    gap: spacing.xs,
  },
  formSectionHalf: {
    flex: 1,
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: layout.inputHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
  },
  iconPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  iconPickerCard: {
    width: 88,
    minHeight: 74,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconPickerCardPressed: {
    opacity: 0.92,
  },
  iconPickerGlyph: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  iconPickerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  displayPickerList: {
    gap: spacing.sm,
  },
  displayPickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  displayPickerCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  displayPickerCardPressed: {
    opacity: 0.92,
  },
  displayPickerAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 999,
  },
  displayPickerCopy: {
    flex: 1,
    gap: 2,
  },
  displayPickerName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  displayPickerSummary: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  displayPickerWindow: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pill: {
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  pillPressed: {
    opacity: 0.9,
  },
  pillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  pillTextActive: {
    color: colors.accent,
  },
  selectedDisplayPreview: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
    gap: 4,
  },
  selectedDisplayPreviewLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
  },
  selectedDisplayPreviewTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  selectedDisplayPreviewBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  secondaryButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  secondaryButtonPressed: {
    opacity: 0.9,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accent,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: colors.onAccent,
    fontSize: typography.body,
    fontWeight: '800',
  },
});
