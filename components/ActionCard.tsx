import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {colors, spacing, radii} from '../theme';

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
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  pressed: {opacity: 0.85},
  row: {flexDirection: 'row', alignItems: 'center'},
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#0F1A1D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textWrap: {flex: 1},
  title: {color: colors.text, fontSize: 16, fontWeight: '700'},
  subtitle: {color: colors.textMuted, fontSize: 13, marginTop: 2},
});
