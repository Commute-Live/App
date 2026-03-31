import {StyleSheet} from 'react-native';
import {colors, radii, spacing} from '../../../theme';

export const styles = StyleSheet.create({
  // ─── Layout ──────────────────────────────────────────────────────────────
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 120,
    gap: spacing.xl,
  },
  loadingContainer: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm},
  loadingText: {color: colors.textMuted, fontSize: 13},

  // ─── Fixed App Header ────────────────────────────────────────────────────
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoWrap: {
    position: 'absolute',
    left: spacing.lg,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appLogo: {
    width: 26,
    height: 26,
  },
  wordmarkLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  wordmark: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  avatarCircle: {
    position: 'absolute',
    right: spacing.lg,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },

  // ─── Page Header (device linked — not a card) ────────────────────────────
  pageHeader: {
    paddingTop: 0,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
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
  pageHeaderLeft: {gap: 3},
  pageStatusText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 33,
  },
  pageHeaderMeta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },

  // ─── Status Pill ─────────────────────────────────────────────────────────
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  statusPillOn: {backgroundColor: '#0E2B21', borderColor: '#1B5E4A'},
  statusPillOff: {backgroundColor: colors.surface, borderColor: colors.border},
  statusDot: {width: 8, height: 8, borderRadius: 4},
  statusDotOn: {backgroundColor: '#34D399'},
  statusDotOff: {backgroundColor: colors.textMuted},
  statusPillText: {color: colors.text, fontSize: 13, fontWeight: '700'},

  // ─── Device Switcher (inside page header) ────────────────────────────────
  deviceSwitcherRow: {gap: spacing.xs, paddingTop: spacing.xs},
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
    padding: spacing.lg,
    gap: spacing.md,
  },
  noDeviceCard: {borderColor: colors.warning, borderStyle: 'dashed'},

  // ─── No-Device Card Elements ──────────────────────────────────────────────
  deviceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deviceHeaderText: {flex: 1, gap: 4},
  sectionLabel: {color: colors.text, fontSize: 15, fontWeight: '800'},
  deviceSubMeta: {color: colors.textMuted, fontSize: 13},

  // ─── Borderless Section ───────────────────────────────────────────────────
  sectionBlock: {
    gap: spacing.sm,
  },
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
  heroHeader: {gap: 4},
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
    gap: 6,
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
    gap: 5,
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
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyStateBody: {gap: spacing.xs},
  emptyStateTitle: {color: colors.text, fontSize: 15, fontWeight: '800'},
  emptyStateText: {color: colors.textMuted, fontSize: 13, lineHeight: 19},
  commandError: {color: colors.warning, fontSize: 12},
  setupButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
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
  cardSubtitle: {color: colors.textMuted, fontSize: 13, marginTop: 2},

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
    gap: 6,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderWidth: 1,
    flexShrink: 0,
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
    gap: 8,
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
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeFieldButtonText: {color: colors.text, fontSize: 18, fontWeight: '600'},
  timeFieldValue: {color: colors.text, fontSize: 14, fontWeight: '800'},

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
