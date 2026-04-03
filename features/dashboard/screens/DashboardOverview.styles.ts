import {StyleSheet} from 'react-native';
import {colors, layout, radii, spacing, typography} from '../../../theme';

export const styles = StyleSheet.create({
  // ─── Layout ──────────────────────────────────────────────────────────────
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.screenPadding,
    paddingBottom: layout.bottomInset,
    gap: layout.screenGap,
  },
  loadingContainer: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm},
  loadingText: {color: colors.textMuted, fontSize: typography.body},

  // ─── Page Header (device linked — not a card) ────────────────────────────
  pageHeader: {
    paddingTop: 0,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  pageOverline: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pageHeaderLeft: {gap: spacing.xxs},
  pageStatusText: {
    color: colors.text,
    fontSize: typography.pageTitle,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 33,
  },
  pageHeaderMeta: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 18,
  },

  // ─── Status Pill ─────────────────────────────────────────────────────────
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 36,
  },
  statusPillOn: {backgroundColor: '#0E2B21', borderColor: '#1B5E4A'},
  statusPillOff: {backgroundColor: colors.surface, borderColor: colors.border},
  statusDot: {width: 8, height: 8, borderRadius: 4},
  statusDotOn: {backgroundColor: '#34D399'},
  statusDotOff: {backgroundColor: colors.textMuted},
  statusPillText: {color: colors.text, fontSize: 13, fontWeight: '700'},

  // ─── Device Switcher (inside page header) ────────────────────────────────
  deviceSwitcherRow: {gap: spacing.xs, paddingTop: spacing.sm},
  switcherLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  devicePill: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 36,
    justifyContent: 'center',
  },
  devicePillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  devicePillText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  devicePillTextActive: {color: colors.accent},

  // ─── Generic Card ─────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: layout.cardPaddingLg,
    gap: layout.screenGap,
  },
  noDeviceCard: {borderColor: colors.warning, borderStyle: 'dashed'},

  // ─── No-Device Card Elements ──────────────────────────────────────────────
  deviceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deviceHeaderText: {flex: 1, gap: spacing.xxs},
  sectionLabel: {color: colors.text, fontSize: 15, fontWeight: '800'},
  deviceSubMeta: {color: colors.textMuted, fontSize: 13},

  // ─── Borderless Section ───────────────────────────────────────────────────
  sectionBlock: {gap: spacing.md},
  sectionBlockLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mtaBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  mtaBadgeText: {fontSize: 10, fontWeight: '900'},
  heroHeader: {gap: spacing.xxs},
  heroBrandLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroDisplayMeta: {color: colors.textMuted, fontSize: 12, lineHeight: 17},

  // ─── Hero Label Row (section label + inline carousel) ────────────────────
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  carouselControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  slideshowControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  carouselArrowBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRow: {
    flexDirection: 'row',
    gap: spacing.xxs,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 14,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },

  // ─── LED Display ─────────────────────────────────────────────────────────
  ledContainer: {width: '100%', marginTop: spacing.xs},

  // ─── Empty / Error State ──────────────────────────────────────────────────
  emptyState: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: layout.cardPaddingLg,
    gap: spacing.md,
  },
  emptyStateBody: {gap: spacing.xs},
  emptyStateTitle: {color: colors.text, fontSize: 15, fontWeight: '800'},
  emptyStateText: {color: colors.textMuted, fontSize: 13, lineHeight: 19},
  commandError: {color: colors.warning, fontSize: 12},
  setupButton: {
    backgroundColor: colors.accent,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  setupButtonText: {color: colors.background, fontWeight: '800', fontSize: 13},

  // ─── Card Section Header ──────────────────────────────────────────────────
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardTitle: {color: colors.text, fontSize: 15, fontWeight: '800'},
  cardSubtitle: {color: colors.textMuted, fontSize: 13, marginTop: spacing.xxs},

  // ─── Quiet Hours Header ───────────────────────────────────────────────────
  quietHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  quietDescription: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },

  // ─── Toggle Chip ──────────────────────────────────────────────────────────
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    flexShrink: 0,
    minHeight: 36,
  },
  toggleChipOn: {backgroundColor: '#0E2B21', borderColor: '#1B5E4A'},
  toggleChipOff: {backgroundColor: colors.surface, borderColor: colors.border},
  toggleDot: {width: 7, height: 7, borderRadius: 4},
  toggleDotOn: {backgroundColor: '#34D399'},
  toggleDotOff: {backgroundColor: colors.textMuted},
  toggleChipText: {color: colors.text, fontSize: 13, fontWeight: '700'},

  // ─── Quiet Hours / Time Fields ────────────────────────────────────────────
  quietRangeRow: {flexDirection: 'row', gap: spacing.sm},
  timeField: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
    minHeight: 76,
  },
  timeFieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  timeFieldControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  timeFieldButton: {
    width: layout.chromeSize,
    height: layout.chromeSize,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeFieldButtonText: {color: colors.text, fontSize: 18, fontWeight: '600'},
  timeFieldValue: {color: colors.text, fontSize: 14, fontWeight: '800'},

  // ─── ESP Payload Debug ───────────────────────────────────────────────────
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  debugChevron: {color: colors.textMuted, fontSize: 12},
  debugCopyBtn: {
    alignSelf: 'flex-end',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  debugCopyText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  debugBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 500,
  },
  debugBoxContent: {padding: spacing.sm},
  debugText: {
    color: '#34D399',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 17,
  },

  // ─── Secondary Button ─────────────────────────────────────────────────────
  secondaryButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {color: colors.text, fontSize: 13, fontWeight: '700'},
});
