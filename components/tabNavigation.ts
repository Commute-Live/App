import type {Href} from 'expo-router';
import type {BottomNavItem} from './BottomNav';

export type TabRoute = '/dashboard' | '/presets' | '/settings';

export const TAB_NAV_ITEMS: BottomNavItem[] = [
  {key: 'home', label: 'Home', icon: 'home-outline', route: '/dashboard'},
  {key: 'presets', label: 'Displays', icon: 'albums-outline', route: '/presets'},
  {key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings'},
];

export const TAB_ROUTES: TabRoute[] = TAB_NAV_ITEMS.map(item => item.route as TabRoute);

const toRouteString = (route: Href) => (typeof route === 'string' ? route : null);

export const getTabIndex = (pathname: string) =>
  TAB_NAV_ITEMS.findIndex((item) => {
    const route = toRouteString(item.route);
    return route === pathname || (!!route && pathname.startsWith(`${route}/`));
  });

export const getAdjacentTabRoute = (pathname: string, direction: -1 | 1): TabRoute | null => {
  const currentIndex = getTabIndex(pathname);
  if (currentIndex === -1) return null;
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= TAB_ROUTES.length) return null;
  return TAB_ROUTES[nextIndex] ?? null;
};
