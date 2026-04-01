import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {colors, layout, spacing, typography} from '../theme';

export const ScreenHeader = ({title}: {title: string}) => {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.headerHeight,
    paddingVertical: spacing.sm,
  },
  back: {
    width: layout.iconButton,
    height: layout.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.xs,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  spacer: {width: layout.iconButton},
});
