import React, {createContext, useContext, useEffect} from 'react';
import {StyleSheet, type StyleProp, type ViewStyle, View} from 'react-native';
import {usePathname} from 'expo-router';
import {type TabRoute} from './tabNavigation';

type TabScreenHostContextValue = {
  activeRoute: TabRoute;
  setSwipeEnabled: (route: TabRoute, enabled: boolean) => void;
};

export const TabScreenHostContext = createContext<TabScreenHostContextValue | null>(null);

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  swipeEnabled?: boolean;
  tabRoute?: TabRoute;
}

const matchesRoute = (pathname: string, route: TabRoute) =>
  pathname === route || pathname.startsWith(`${route}/`);

export const useTabRouteIsActive = (route: TabRoute) => {
  const pathname = usePathname();
  const host = useContext(TabScreenHostContext);
  const activePath = host?.activeRoute ?? pathname;
  return matchesRoute(activePath, route);
};

export function TabScreen({children, style, swipeEnabled = true, tabRoute}: Props) {
  const host = useContext(TabScreenHostContext);
  const isHostedRouteActive = !!host && !!tabRoute && matchesRoute(host.activeRoute, tabRoute);

  useEffect(() => {
    if (!host || !tabRoute || !isHostedRouteActive) return;
    host.setSwipeEnabled(tabRoute, swipeEnabled);
    return () => {
      host.setSwipeEnabled(tabRoute, true);
    };
  }, [host, isHostedRouteActive, swipeEnabled, tabRoute]);

  if (host) {
    return <View style={[styles.content, style]}>{children}</View>;
  }

  return <View style={[styles.container, styles.content, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
