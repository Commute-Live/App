import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import {usePathname, useRouter} from 'expo-router';
import {BottomNav} from '../../components/BottomNav';
import {TabScreenHostContext} from '../../components/TabScreen';
import {
  TAB_NAV_ITEMS,
  TAB_ROUTES,
  getAdjacentTabRoute,
  getTabIndex,
  type TabRoute,
} from '../../components/tabNavigation';
import DashboardOverviewScreen from '../../features/dashboard/screens/DashboardOverviewScreen';
import SettingsScreen from '../../features/settings/screens/SettingsScreen';
import {colors} from '../../theme';

const SWIPE_DISTANCE_PX = 56;
const SWIPE_VELOCITY = 0.2;
const HORIZONTAL_DOMINANCE_RATIO = 1.25;
const EDGE_RESISTANCE = 0.28;
const SNAP_DURATION_MS = 180;

const TAB_COMPONENTS: Record<TabRoute, React.ComponentType> = {
  '/dashboard': DashboardOverviewScreen,
  '/settings': SettingsScreen,
};

const isTabSwipeGesture = (_event: GestureResponderEvent, gestureState: PanResponderGestureState) =>
  Math.abs(gestureState.dx) > 18 &&
  Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * HORIZONTAL_DOMINANCE_RATIO;

const shouldNavigateTab = (gestureState: PanResponderGestureState) =>
  Math.abs(gestureState.dx) >= SWIPE_DISTANCE_PX || Math.abs(gestureState.vx) >= SWIPE_VELOCITY;

const resolveActiveIndex = (pathname: string) => {
  const routeIndex = getTabIndex(pathname);
  return routeIndex === -1 ? 0 : routeIndex;
};

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const {width} = useWindowDimensions();
  const activeIndex = resolveActiveIndex(pathname);
  const activeRoute = TAB_ROUTES[activeIndex] ?? '/dashboard';
  const [swipeEnabledByRoute, setSwipeEnabledByRoute] = useState<Record<TabRoute, boolean>>({
    '/dashboard': true,
    '/settings': true,
  });
  const translateX = useRef(new Animated.Value(-activeIndex * width)).current;
  const activeIndexRef = useRef(activeIndex);
  const isDraggingRef = useRef(false);

  const setSwipeEnabled = useCallback((route: TabRoute, enabled: boolean) => {
    setSwipeEnabledByRoute(prev => (prev[route] === enabled ? prev : {...prev, [route]: enabled}));
  }, []);

  const snapToIndex = useCallback(
    (index: number, onComplete?: () => void) => {
      Animated.timing(translateX, {
        toValue: -index * width,
        duration: SNAP_DURATION_MS,
        useNativeDriver: true,
      }).start(({finished}) => {
        if (finished) {
          onComplete?.();
        }
      });
    },
    [translateX, width],
  );

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    if (isDraggingRef.current) return;
    translateX.stopAnimation();
    translateX.setValue(-activeIndex * width);
  }, [activeIndex, translateX, width]);

  const swipeEnabled = swipeEnabledByRoute[activeRoute] ?? true;

  const panHandlers = useMemo(() => {
    if (!swipeEnabled) return undefined;

    return PanResponder.create({
      onMoveShouldSetPanResponder: isTabSwipeGesture,
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        translateX.stopAnimation();
      },
      onPanResponderMove: (_event, gestureState) => {
        const direction: -1 | 1 = gestureState.dx < 0 ? 1 : -1;
        const nextRoute = getAdjacentTabRoute(activeRoute, direction);
        const resistance = nextRoute ? 1 : EDGE_RESISTANCE;
        const baseOffset = -activeIndexRef.current * width;
        translateX.setValue(baseOffset + gestureState.dx * resistance);
      },
      onPanResponderRelease: (_event, gestureState) => {
        isDraggingRef.current = false;
        const direction: -1 | 1 = gestureState.dx < 0 ? 1 : -1;
        const nextRoute = getAdjacentTabRoute(activeRoute, direction);
        if (!shouldNavigateTab(gestureState) || !nextRoute) {
          snapToIndex(activeIndexRef.current);
          return;
        }

        const targetIndex = activeIndexRef.current + direction;
        snapToIndex(targetIndex, () => {
          router.navigate(nextRoute);
        });
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        snapToIndex(activeIndexRef.current);
      },
      onPanResponderTerminationRequest: () => true,
    }).panHandlers;
  }, [activeRoute, router, snapToIndex, swipeEnabled, translateX, width]);

  return (
    <TabScreenHostContext.Provider value={{activeRoute, setSwipeEnabled}}>
      <View style={styles.container}>
        <View style={styles.viewport} {...panHandlers}>
          <Animated.View
            style={[
              styles.track,
              {
                width: width * TAB_ROUTES.length,
                transform: [{translateX}],
              },
            ]}>
            {TAB_ROUTES.map(route => {
              const ScreenComponent = TAB_COMPONENTS[route];
              return (
                <View key={route} style={[styles.page, {width}]}>
                  <ScreenComponent />
                </View>
              );
            })}
          </Animated.View>
        </View>
        <BottomNav items={TAB_NAV_ITEMS} />
      </View>
    </TabScreenHostContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
  track: {
    flex: 1,
    flexDirection: 'row',
  },
  page: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
});
