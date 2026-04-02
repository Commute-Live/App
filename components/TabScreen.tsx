import React, {useMemo} from 'react';
import {
  PanResponder,
  StyleSheet,
  type GestureResponderEvent,
  type GestureResponderHandlers,
  type GestureResponderState,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import {usePathname, useRouter} from 'expo-router';
import {BottomNav} from './BottomNav';
import {TAB_NAV_ITEMS, getAdjacentTabRoute} from './tabNavigation';

const SWIPE_DISTANCE_PX = 56;
const SWIPE_VELOCITY = 0.2;
const HORIZONTAL_DOMINANCE_RATIO = 1.25;

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  swipeEnabled?: boolean;
}

const isTabSwipeGesture = (_event: GestureResponderEvent, gestureState: GestureResponderState) =>
  Math.abs(gestureState.dx) > 18 &&
  Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * HORIZONTAL_DOMINANCE_RATIO;

const shouldNavigateTab = (gestureState: GestureResponderState) =>
  Math.abs(gestureState.dx) >= SWIPE_DISTANCE_PX || Math.abs(gestureState.vx) >= SWIPE_VELOCITY;

export function TabScreen({children, style, swipeEnabled = true}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const panHandlers = useMemo<GestureResponderHandlers | undefined>(() => {
    if (!swipeEnabled) return undefined;

    return PanResponder.create({
      onMoveShouldSetPanResponder: isTabSwipeGesture,
      onPanResponderRelease: (_event, gestureState) => {
        if (!shouldNavigateTab(gestureState)) return;

        const direction: -1 | 1 = gestureState.dx < 0 ? 1 : -1;
        const nextRoute = getAdjacentTabRoute(pathname, direction);
        if (!nextRoute) return;
        router.navigate(nextRoute);
      },
      onPanResponderTerminationRequest: () => true,
    }).panHandlers;
  }, [pathname, router, swipeEnabled]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content} {...panHandlers}>
        {children}
      </View>
      <BottomNav items={TAB_NAV_ITEMS} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
