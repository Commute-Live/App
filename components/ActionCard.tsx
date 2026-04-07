import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {colors, layout, spacing, radii, typography} from '../theme';

interface Props {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export const ActionCard: React.FC<Props> = ({title, subtitle, icon, onPress}) => (
  <Pressable onPress={onPress} style={({pressed}) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    padding: layout.cardPaddingLg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {opacity: 0.85},
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {flex: 1, gap: spacing.xxs},
  title: {color: colors.text, fontSize: typography.title, fontWeight: '700'},
  subtitle: {color: colors.textMuted, fontSize: typography.body},
});
