import React, {useEffect, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, Text, View, type GestureResponderEvent} from 'react-native';
import type {StyleProp, TextStyle} from 'react-native';
import {colors, radii, spacing} from '../../../theme';

export type Display3DSlot = {
  id: string;
  color: string;
  textColor: string;
  routeLabel: string;
  badgeShape?: 'circle' | 'pill' | 'rail' | 'bar';
  selected: boolean;
  stopName: string;
  scrollLabel?: boolean;
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
  emptyMessage?: string;
  showGlow?: boolean;
};

function MarqueeText({
  text,
  textStyle,
  enabled,
  scrollClock,
}: {
  text: string;
  textStyle: StyleProp<TextStyle>;
  enabled: boolean;
  scrollClock?: Animated.Value;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const ownTranslateX = useRef(new Animated.Value(0)).current;
  const overflow = textWidth > containerWidth + 6 ? textWidth - containerWidth : 0;
  const shouldAnimate = enabled && containerWidth > 0 && overflow > 0;

  // Standalone animation (used when no shared clock)
  useEffect(() => {
    if (scrollClock) return;
    ownTranslateX.stopAnimation();
    ownTranslateX.setValue(0);
    if (!shouldAnimate) return;

    let cancelled = false;
    const runLoop = () => {
      if (cancelled) return;
      ownTranslateX.setValue(0);
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(ownTranslateX, {
          toValue: -overflow,
          duration: Math.max(4000, overflow * 60),
          useNativeDriver: true,
        }),
        Animated.delay(3000),
      ]).start(({finished}) => {
        if (finished && !cancelled) runLoop();
      });
    };
    runLoop();
    return () => {
      cancelled = true;
      ownTranslateX.stopAnimation();
    };
  }, [shouldAnimate, overflow, ownTranslateX, scrollClock]);

  const translateX = scrollClock
    ? scrollClock.interpolate({inputRange: [0, 1], outputRange: [0, shouldAnimate ? -overflow : 0]})
    : ownTranslateX;

  return (
    <View style={styles.marqueeWrap} onLayout={event => setContainerWidth(event.nativeEvent.layout.width)}>
      <Text
        style={[textStyle, styles.marqueeMeasure]}
        numberOfLines={1}
        onTextLayout={event => {
          const lineWidth = event.nativeEvent.lines[0]?.width ?? 0;
          setTextWidth(lineWidth);
        }}>
        {text}
      </Text>
      {shouldAnimate ? (
        <Animated.View style={[styles.marqueeContent, {width: textWidth, transform: [{translateX}]}]}>
          <Text style={textStyle} numberOfLines={1}>
            {text}
          </Text>
        </Animated.View>
      ) : (
        <Text style={textStyle} numberOfLines={1} ellipsizeMode="tail">
          {text}
        </Text>
      )}
    </View>
  );
}

export default function Display3DPreview({
  slots,
  displayType = 1,
  onSelectSlot,
  onReorderSlot,
  onDragStateChange,
  showHint = true,
  brightness = 100,
  mini = false,
  emptyMessage,
  showGlow = true,
}: Props) {
  const compact = slots.length > 1 || displayType >= 3;
  const safeBrightness = Math.max(0, Math.min(100, brightness));
  const brightnessOverlayOpacity = ((100 - safeBrightness) / 100) * 0.65;
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const scrollingSlots = slots.filter(s => s.scrollLabel);
  const hasMultipleScrolling = scrollingSlots.length > 1;
  const scrollClock = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hasMultipleScrolling) return;
    let cancelled = false;
    const runLoop = () => {
      if (cancelled) return;
      scrollClock.setValue(0);
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(scrollClock, {
          toValue: 1,
          duration: 6000,
          useNativeDriver: true,
        }),
        Animated.delay(3000),
      ]).start(({finished}) => {
        if (finished && !cancelled) runLoop();
      });
    };
    runLoop();
    return () => {
      cancelled = true;
      scrollClock.stopAnimation();
    };
  }, [hasMultipleScrolling, scrollClock]);
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
    <View style={[styles.wrap, !showGlow && styles.wrapNoGlow]}>
      {showGlow ? <View style={[styles.glowOuter, mini && styles.glowOuterMini]} /> : null}
      {showGlow ? <View style={[styles.glowInner, mini && styles.glowInnerMini]} /> : null}
      <View style={styles.device}>
        <View style={[styles.screen, compact && styles.screenCompact, mini && styles.screenMini]}>
          {emptyMessage ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{emptyMessage}</Text>
            </View>
          ) : (
            slots.map(slot => (
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
                <View style={[styles.slotLead, compact && styles.slotLeadCompact]}>
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
                          {color: slot.badgeShape === 'circle' ? '#FFFFFF' : slot.textColor},
                        ]}>
                        {slot.routeLabel}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.slotBody}>
                  {slot.stopName ? (
                    <MarqueeText
                      text={slot.stopName}
                      textStyle={[
                        styles.slotTitle,
                        compact && styles.slotTitleCompact,
                      ]}
                      enabled={slot.scrollLabel === true}
                      scrollClock={hasMultipleScrolling && slot.scrollLabel ? scrollClock : undefined}
                    />
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
                <View style={[styles.slotTrailing, compact && styles.slotTrailingCompact]}>
                  <Text
                    style={[
                      styles.slotTimes,
                      compact && styles.slotTimesCompact,
                      slot.timesColor ? {color: slot.timesColor} : null,
                    ]}
                    numberOfLines={1}>
                    {slot.times}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
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
  wrap: {gap: spacing.xs, position: 'relative', marginHorizontal: -20, paddingHorizontal: 20, paddingBottom: 8},
  wrapNoGlow: {marginHorizontal: 0, paddingHorizontal: 0, paddingBottom: 0},
  glowOuter: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 6,
    bottom: 14,
    borderRadius: radii.lg,
    backgroundColor: '#FF7A2F',
    shadowColor: '#FF6000',
    shadowOpacity: 0.65,
    shadowRadius: 36,
    shadowOffset: {width: 0, height: 0},
    elevation: 12,
  },
  glowInner: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 6,
    bottom: 14,
    borderRadius: radii.lg,
    backgroundColor: '#FFB347',
    shadowColor: '#FFAA00',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: {width: 0, height: 0},
    elevation: 12,
  },
  device: {
    borderRadius: radii.lg,
    padding: spacing.xs,
    borderWidth: 0,
    backgroundColor: colors.displayShellSurface,
    gap: 0,
  },
  screen: {
    height: 144,
    borderRadius: radii.md,
    borderWidth: 0,
    backgroundColor: colors.editorMockSurface,
    padding: spacing.sm,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  screenMini: {
    height: 90,
  },
  glowOuterMini: {
    top: 4,
    bottom: 8,
    shadowRadius: 32,
  },
  glowInnerMini: {
    top: 4,
    bottom: 8,
    shadowRadius: 14,
  },
  screenCompact: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyStateText: {
    color: colors.displayPlaceholder,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  slot: {
    flex: 1,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    paddingHorizontal: 5,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotCompact: {
    minHeight: 0,
    paddingHorizontal: 5,
    paddingVertical: 10,
  },
  slotActive: {
    backgroundColor: colors.displaySlotActiveSurface,
    borderColor: colors.accent,
    borderWidth: 1.5,
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 0},
    elevation: 8,
    zIndex: 2,
  },
  slotDragging: {
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
    zIndex: 5,
  },
  slotLead: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  slotLeadCompact: {
    width: 46,
  },
  routeBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeBadgeCompact: {width: 30, height: 30, borderRadius: 15},
  routeBadgePill: {width: undefined, minWidth: 44, height: 26, borderRadius: 8, paddingHorizontal: 6},
  routeBadgePillCompact: {width: undefined, minWidth: 44, height: 26, borderRadius: 8, paddingHorizontal: 6},
  routeBadgeRail: {width: 40, height: 30, borderRadius: 8, paddingHorizontal: 3},
  routeBadgeRailCompact: {width: 40, height: 30, borderRadius: 8, paddingHorizontal: 3},
  routeBadgeBarWrap: {width: 30, height: 30, alignItems: 'center', justifyContent: 'center'},
  routeBadgeBarWrapCompact: {width: 30, height: 30},
  routeBadgeBar: {width: 10, height: 28, borderRadius: 3},
  routeBadgeBarCompact: {width: 10, height: 28, borderRadius: 3},
  routeBadgeText: {fontSize: 13, fontWeight: '900'},
  routeBadgeTextPill: {fontSize: 11, lineHeight: 13, textAlign: 'center', includeFontPadding: false},
  routeBadgeTextCompact: {fontSize: 13},
  routeBadgeTextPillCompact: {fontSize: 11, lineHeight: 13},
  routeBadgeTextPillCompactShort: {fontSize: 12, lineHeight: 14, textAlign: 'center', includeFontPadding: false},
  routeBadgeTextRail: {fontSize: 12, lineHeight: 14, textAlign: 'center', includeFontPadding: false},
  routeBadgeTextRailCompact: {fontSize: 9, lineHeight: 10},
  slotBody: {flex: 1, minWidth: 0},
  marqueeWrap: {overflow: 'hidden', width: '100%'},
  marqueeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  marqueeMeasure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
    width: 2000,
  },
  slotTitle: {color: colors.displayTitle, fontSize: 20, fontWeight: '800'},
  slotTitleCompact: {fontSize: 15},
  slotTitlePlaceholder: {
    height: 16,
    width: '88%',
    borderRadius: 8,
    backgroundColor: colors.displayPlaceholder,
    opacity: 0.45,
    marginVertical: 3,
  },
  slotTitlePlaceholderCompact: {
    height: 14,
    width: '84%',
    marginVertical: 2,
  },
  slotSubLine: {color: colors.displaySubtleText, fontSize: 12, marginTop: 1},
  slotSubLineCompact: {fontSize: 11},
  slotTrailing: {
    width: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  slotTrailingCompact: {
    width: 36,
  },
  slotTimes: {color: colors.displayTimeText, fontSize: 14, fontWeight: '700', minWidth: 0, textAlign: 'right'},
  slotTimesCompact: {fontSize: 14, minWidth: 0},
  brightnessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.shadow,
    borderRadius: radii.md,
  },
  hint: {color: colors.textMuted, fontSize: 11, paddingLeft: 2},
});
