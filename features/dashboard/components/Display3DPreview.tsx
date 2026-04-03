import React, {useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View, type GestureResponderEvent} from 'react-native';
import {colors, radii, spacing} from '../../../theme';

export type Display3DSlot = {
  id: string;
  color: string;
  textColor: string;
  routeLabel: string;
  badgeShape?: 'circle' | 'pill' | 'rail' | 'bar';
  selected: boolean;
  stopName: string;
  subLine?: string;
  subLineColor?: string;
  times: string;
  timesColor?: string;
};

type Props = {
  slots: Display3DSlot[];
  displayType?: number;
  onSelectSlot: (id: string) => void;
  onReorderSlot: (id: string) => void;
  onDragStateChange?: (dragging: boolean) => void;
  showHint?: boolean;
  brightness?: number;
  mini?: boolean;
};

export default function Display3DPreview({
  slots,
  displayType = 1,
  onSelectSlot,
  onReorderSlot,
  onDragStateChange,
  showHint = true,
  brightness = 100,
  mini = false,
}: Props) {
  const compact = slots.length > 1 || displayType >= 3;
  const safeBrightness = Math.max(0, Math.min(100, brightness));
  const brightnessOverlayOpacity = ((100 - safeBrightness) / 100) * 0.65;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartYRef = useRef<Record<string, number>>({});
  const dragOriginYRef = useRef(0);
  const lastSwapAtRef = useRef(0);

  const handlePressIn = (id: string, pageY: number) => {
    dragStartYRef.current[id] = pageY;
  };

  const handleLongPress = (id: string) => {
    const startY = dragStartYRef.current[id];
    if (!Number.isFinite(startY)) return;
    dragOriginYRef.current = startY;
    setDraggingId(id);
    setDragOffsetY(0);
    lastSwapAtRef.current = 0;
    onDragStateChange?.(true);
  };

  const handleTouchMove = (id: string, pageY: number) => {
    if (draggingId !== id) return;
    const delta = pageY - dragOriginYRef.current;
    setDragOffsetY(delta);
    if (slots.length < 2) return;

    const now = Date.now();
    const crossedSwapThreshold = Math.abs(delta) > 36;
    const swapCooldownElapsed = now - lastSwapAtRef.current > 220;
    if (!crossedSwapThreshold || !swapCooldownElapsed) return;

    onReorderSlot(id);
    lastSwapAtRef.current = now;
    dragOriginYRef.current = pageY;
    setDragOffsetY(0);
  };

  const endDrag = () => {
    setDraggingId(null);
    setDragOffsetY(0);
    onDragStateChange?.(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.glowOuter, mini && styles.glowOuterMini]} />
      <View style={[styles.glowInner, mini && styles.glowInnerMini]} />
      <View style={styles.device}>
        <View style={[styles.screen, compact && styles.screenCompact, mini && styles.screenMini]}>
          {slots.map(slot => (
            <Pressable
              key={slot.id}
              style={[
                styles.slot,
                slot.selected && styles.slotActive,
                compact && styles.slotCompact,
                draggingId === slot.id && styles.slotDragging,
                draggingId === slot.id && {transform: [{translateY: dragOffsetY}]},
              ]}
              onPress={() => onSelectSlot(slot.id)}
              onPressIn={event => handlePressIn(slot.id, event.nativeEvent.pageY)}
              onLongPress={() => handleLongPress(slot.id)}
              onTouchMove={(event: GestureResponderEvent) => handleTouchMove(slot.id, event.nativeEvent.pageY)}
              onPressOut={endDrag}
              delayLongPress={260}>
              {slot.badgeShape === 'bar' ? (
                <View style={[styles.routeBadgeBarWrap, compact && styles.routeBadgeBarWrapCompact]}>
                  <View style={[styles.routeBadgeBar, compact && styles.routeBadgeBarCompact, {backgroundColor: slot.color}]} />
                </View>
              ) : (
                <View
                  style={[
                    styles.routeBadge,
                    compact && styles.routeBadgeCompact,
                    slot.badgeShape === 'pill' && styles.routeBadgePill,
                    compact && slot.badgeShape === 'pill' && styles.routeBadgePillCompact,
                    slot.badgeShape === 'rail' && styles.routeBadgeRail,
                    compact && slot.badgeShape === 'rail' && styles.routeBadgeRailCompact,
                    {backgroundColor: slot.color},
                  ]}>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                    numberOfLines={1}
                    style={[
                      styles.routeBadgeText,
                      slot.badgeShape === 'pill' && styles.routeBadgeTextPill,
                      compact && styles.routeBadgeTextCompact,
                      compact && slot.badgeShape === 'pill' && styles.routeBadgeTextPillCompact,
                      slot.badgeShape === 'rail' && styles.routeBadgeTextRail,
                      compact && slot.badgeShape === 'rail' && styles.routeBadgeTextRailCompact,
                      {color: slot.textColor},
                    ]}>
                    {slot.routeLabel}
                  </Text>
                </View>
              )}
              <View style={styles.slotBody}>
                {slot.stopName ? (
                  <Text
                    style={[
                      styles.slotTitle,
                      compact && styles.slotTitleCompact,
                    ]}
                    numberOfLines={1}>
                    {slot.stopName}
                  </Text>
                ) : (
                  <View style={[styles.slotTitlePlaceholder, compact && styles.slotTitlePlaceholderCompact]} />
                )}
                {slot.subLine ? (
                  <Text
                    style={[
                      styles.slotSubLine,
                      compact && styles.slotSubLineCompact,
                      slot.subLineColor ? {color: slot.subLineColor} : null,
                    ]}
                    numberOfLines={1}>
                    {slot.subLine}
                  </Text>
                ) : null}
              </View>
              <Text
                style={[
                  styles.slotTimes,
                  compact && styles.slotTimesCompact,
                  slot.timesColor ? {color: slot.timesColor} : null,
                ]}
                numberOfLines={1}>
                {slot.times}
              </Text>
            </Pressable>
          ))}
          {brightnessOverlayOpacity > 0 ? (
            <View pointerEvents="none" style={[styles.brightnessOverlay, {opacity: brightnessOverlayOpacity}]} />
          ) : null}
        </View>
      </View>
      {showHint ? <Text style={styles.hint}>Tap to edit. Hold and drag up or down to reorder.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: spacing.xs, position: 'relative'},
  glowOuter: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 12,
    bottom: 20,
    borderRadius: 30,
    backgroundColor: '#5CE1E6',
    opacity: 0.25,
    shadowColor: '#5CE1E6',
    shadowOpacity: 1,
    shadowRadius: 70,
    shadowOffset: {width: 0, height: 0},
    elevation: 24,
  },
  glowInner: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 24,
    bottom: 32,
    borderRadius: 24,
    backgroundColor: '#5CE1E6',
    opacity: 0.2,
    shadowColor: '#5CE1E6',
    shadowOpacity: 1,
    shadowRadius: 45,
    shadowOffset: {width: 0, height: 0},
  },
  device: {
    borderRadius: radii.lg,
    padding: spacing.xs,
    borderWidth: 0,
    backgroundColor: '#0A0D12',
    gap: 0,
  },
  screen: {
    height: 144,
    borderRadius: radii.md,
    borderWidth: 0,
    backgroundColor: '#04070A',
    padding: spacing.xs,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  screenMini: {
    height: 90,
  },
  glowOuterMini: {
    top: 8,
    bottom: 14,
    shadowRadius: 56,
    opacity: 0.24,
  },
  glowInnerMini: {
    top: 18,
    bottom: 24,
    shadowRadius: 34,
    opacity: 0.18,
  },
  screenCompact: {
    paddingVertical: 4,
    gap: 4,
  },
  slot: {
    flex: 1,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#0D131A',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  slotCompact: {
    minHeight: 0,
    paddingVertical: 4,
  },
  slotActive: {
    backgroundColor: '#13222E',
    borderColor: '#5CE1E6',
    shadowColor: '#5CE1E6',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 0},
    elevation: 5,
    zIndex: 2,
  },
  slotDragging: {
    shadowColor: '#5CE1E6',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
    zIndex: 5,
  },
  routeBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeBadgeCompact: {width: 30, height: 30, borderRadius: 15},
  routeBadgePill: {minWidth: 58, height: 36, borderRadius: 10, paddingHorizontal: 8},
  routeBadgePillCompact: {minWidth: 44, height: 26, borderRadius: 8, paddingHorizontal: 6},
  routeBadgeRail: {width: 58, height: 48, borderRadius: 12, paddingHorizontal: 5},
  routeBadgeRailCompact: {width: 40, height: 30, borderRadius: 8, paddingHorizontal: 3},
  routeBadgeBarWrap: {width: 48, height: 48, alignItems: 'center', justifyContent: 'center'},
  routeBadgeBarWrapCompact: {width: 30, height: 30},
  routeBadgeBar: {width: 14, height: 44, borderRadius: 4},
  routeBadgeBarCompact: {width: 10, height: 28, borderRadius: 3},
  routeBadgeText: {fontSize: 20, fontWeight: '900'},
  routeBadgeTextPill: {fontSize: 15, lineHeight: 18, textAlign: 'center', includeFontPadding: false},
  routeBadgeTextCompact: {fontSize: 13},
  routeBadgeTextPillCompact: {fontSize: 11, lineHeight: 13},
  routeBadgeTextPillCompactShort: {fontSize: 12, lineHeight: 14, textAlign: 'center', includeFontPadding: false},
  routeBadgeTextRail: {fontSize: 12, lineHeight: 14, textAlign: 'center', includeFontPadding: false},
  routeBadgeTextRailCompact: {fontSize: 9, lineHeight: 10},
  slotBody: {flex: 1, paddingLeft: 2},
  slotTitle: {color: '#E4EDF6', fontSize: 20, fontWeight: '800'},
  slotTitleCompact: {fontSize: 15},
  slotTitlePlaceholder: {
    height: 16,
    width: '88%',
    borderRadius: 8,
    backgroundColor: '#5C6670',
    opacity: 0.45,
    marginVertical: 3,
  },
  slotTitlePlaceholderCompact: {
    height: 14,
    width: '84%',
    marginVertical: 2,
  },
  slotSubLine: {color: '#8B9EAD', fontSize: 12, marginTop: 1},
  slotSubLineCompact: {fontSize: 11},
  slotTimes: {color: '#D7E3EF', fontSize: 18, fontWeight: '700', minWidth: 60, textAlign: 'right'},
  slotTimesCompact: {fontSize: 14, minWidth: 48},
  brightnessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    borderRadius: radii.md,
  },
  hint: {color: colors.textMuted, fontSize: 11, paddingLeft: 2},
});
