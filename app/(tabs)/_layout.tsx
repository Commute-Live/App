import React, {useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import {usePathname} from 'expo-router';
import {TabScreenHostContext} from '../../components/TabScreen';
import {
  getTabIndex,
  TAB_NAV_ITEMS,
  type TabRoute,
} from '../../components/tabNavigation';
import {BottomNav} from '../../components/BottomNav';
import DashboardOverviewScreen from '../../features/dashboard/screens/DashboardOverviewScreen';
import ScheduleScreen from '../../features/schedule/screens/ScheduleScreen';
import SettingsScreen from '../../features/settings/screens/SettingsScreen';
import {colors} from '../../theme';

const TAB_COMPONENTS: Record<TabRoute, React.ComponentType> = {
  '/dashboard': DashboardOverviewScreen,
  '/schedule': ScheduleScreen,
  '/settings': SettingsScreen,
};

const ROUTE_BY_INDEX: Record<number, TabRoute> = {
  0: '/dashboard',
  1: '/schedule',
  2: '/settings',
};

export default function TabsLayout() {
  const pathname = usePathname();
  const activeRoute = ROUTE_BY_INDEX[Math.max(getTabIndex(pathname), 0)] ?? '/dashboard';
  const ScreenComponent = TAB_COMPONENTS[activeRoute];
  const setSwipeEnabled = useCallback((_route: TabRoute, _enabled: boolean) => {}, []);

  return (
    <TabScreenHostContext.Provider value={{activeRoute, setSwipeEnabled}}>
      <View style={styles.container}>
        <View style={styles.page}>
          <ScreenComponent />
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
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
