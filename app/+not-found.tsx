import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import {colors, layout, radii, spacing, typography} from '../theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenPadding,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: typography.titleLg,
    fontWeight: '800',
    textAlign: 'center',
  },
  link: {
    marginTop: spacing.md,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: typography.bodyLg,
    color: colors.accent,
    fontWeight: '700',
  },
});
