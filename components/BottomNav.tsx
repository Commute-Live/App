import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {usePathname, useRouter, type Href} from 'expo-router';
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

  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);
        return (
        <View key={item.key} style={styles.itemWrap}>
          <Pressable
            style={styles.item}
            onPress={() => {
              if (isActive) return;
              router.navigate(item.route);
            }}>
            <Ionicons name={item.icon} size={18} color={isActive ? colors.text : colors.textMuted} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
          </Pressable>
          {index < items.length - 1 ? <View style={styles.divider} /> : null}
        </View>
      )})}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  itemWrap: {flexDirection: 'row', alignItems: 'center'},
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 64,
    position: 'relative',
  },
  divider: {width: 1, height: 28, backgroundColor: colors.border},
  label: {color: colors.textMuted, fontSize: 11, fontWeight: '600'},
  labelActive: {color: colors.text, fontWeight: '800', opacity: 1},
});
