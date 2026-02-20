import React, {useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View, type GestureResponderEvent} from 'react-native';
import {colors, radii, spacing} from '../../../theme';

export type Display3DSlot = {
  id: string;
  color: string;
  textColor: string;
  routeLabel: string;
  selected: boolean;
  stopName: string;
  times: string;
};

type Props = {
  slots: Display3DSlot[];
  onSelectSlot: (id: string) => void;
  onReorderSlot: (id: string) => void;
  onDragStateChange?: (dragging: boolean) => void;
};

export default function Display3DPreview({slots, onSelectSlot, onReorderSlot, onDragStateChange}: Props) {
  const compact = slots.length > 1;
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
      <View style={styles.glowOuter} />
      <View style={styles.glowInner} />
      <View style={styles.device}>
        <View style={[styles.screen, compact && styles.screenCompact]}>
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
              <View style={[styles.routeBadge, compact && styles.routeBadgeCompact, {backgroundColor: slot.color}]}>
                <Text style={[styles.routeBadgeText, compact && styles.routeBadgeTextCompact, {color: slot.textColor}]}>
                  {slot.routeLabel}
                </Text>
              </View>
              <View style={styles.slotBody}>
                <Text style={[styles.slotTitle, compact && styles.slotTitleCompact]} numberOfLines={1}>
                  {slot.stopName}
                </Text>
              </View>
              <Text style={[styles.slotTimes, compact && styles.slotTimesCompact]} numberOfLines={1}>
                {slot.times}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={styles.hint}>Tap to edit. Hold and drag up or down to reorder.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: spacing.xs, position: 'relative'},
  glowOuter: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 18,
    bottom: 28,
    borderRadius: 30,
    backgroundColor: '#5CE1E6',
    opacity: 0.14,
    shadowColor: '#5CE1E6',
    shadowOpacity: 0.85,
    shadowRadius: 42,
    shadowOffset: {width: 0, height: 0},
    elevation: 16,
  },
  glowInner: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 32,
    bottom: 42,
    borderRadius: 24,
    backgroundColor: '#5CE1E6',
    opacity: 0.12,
    shadowColor: '#5CE1E6',
    shadowOpacity: 0.8,
    shadowRadius: 28,
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
  routeBadgeCompact: {width: 40, height: 40, borderRadius: 20},
  routeBadgeText: {fontSize: 20, fontWeight: '900'},
  routeBadgeTextCompact: {fontSize: 16},
  slotBody: {flex: 1, paddingLeft: 2},
  slotTitle: {color: '#E4EDF6', fontSize: 20, fontWeight: '800'},
  slotTitleCompact: {fontSize: 17},
  slotTimes: {color: '#D7E3EF', fontSize: 18, fontWeight: '700', minWidth: 60, textAlign: 'right'},
  slotTimesCompact: {fontSize: 16, minWidth: 56},
  hint: {color: colors.textMuted, fontSize: 11, paddingLeft: 2},
});
