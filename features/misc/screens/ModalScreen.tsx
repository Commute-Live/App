import {StatusBar} from 'expo-status-bar';
import {Platform, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import EditScreenInfo from '@/components/EditScreenInfo';
import {Text, View} from '@/components/Themed';
import {colors, layout, spacing, typography} from '../../../theme';

export default function ModalScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Text style={styles.title}>Modal</Text>
      <View style={styles.separator} />
      <EditScreenInfo path="features/misc/screens/ModalScreen.tsx" />

      <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
    </SafeAreaView>
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
  },
  separator: {
    marginVertical: spacing.xl,
    height: 1,
    width: '80%',
    backgroundColor: colors.border,
  },
});
