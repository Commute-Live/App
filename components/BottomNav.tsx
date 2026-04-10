import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {usePathname, useRouter, type Href} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, spacing} from '../theme';

export interface BottomNavItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: Href;
}

interface Props {
  items: BottomNavItem[];
}

export const BottomNav: React.FC<Props> = ({items}) => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : spacing.sm;
  const navHeight = 83;

  return (
    <View style={[styles.container, {paddingBottom: bottomPadding, minHeight: navHeight}]}>
      {items.map((item) => {
        const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);
        return (
          <Pressable
            key={item.key}
            style={[styles.item, {minHeight: navHeight - bottomPadding}]}
            onPress={() => {
              if (isActive) return;
              router.navigate(item.route);
            }}
          >
            <View style={[styles.indicator, isActive && styles.indicatorActive]} />
            <Ionicons
              name={item.icon}
              size={22}
              color={isActive ? colors.accent : colors.textSecondary}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: colors.accent,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.accent,
    fontWeight: '800',
  },
});
