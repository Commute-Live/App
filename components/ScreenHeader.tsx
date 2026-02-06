import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {colors, spacing} from '../theme';

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
    paddingVertical: spacing.md,
  },
  back: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  title: {flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '700'},
  spacer: {width: 32},
});
