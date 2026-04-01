import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {usePathname, useRouter, type Href} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, layout, spacing, typography} from '../theme';

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

  return (
    <View style={[styles.container, {paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm}]}>
      {items.map((item) => {
        const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);
        return (
          <Pressable
            key={item.key}
            style={styles.item}
            onPress={() => {
              if (isActive) return;
              router.navigate(item.route);
            }}
          >
            <View style={[styles.indicator, isActive && styles.indicatorActive]} />
            <Ionicons
              name={item.icon}
              size={22}
              color={isActive ? colors.accent : colors.textMuted}
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
    paddingHorizontal: spacing.xs,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: layout.tabHeight,
    paddingVertical: spacing.xs,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: colors.accent,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: colors.accent,
    fontWeight: '800',
  },
});
