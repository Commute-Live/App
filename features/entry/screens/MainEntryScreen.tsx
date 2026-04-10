import React, {useEffect, useState} from 'react';
import {Image, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {colors, spacing} from '../../../theme';
import AuthScreen from '../../auth/screens/AuthScreen';
import {useAuth} from '../../../state/authProvider';
import {getPostAuthRoute} from '../../../lib/deviceSetup';

export default function MainEntryScreen() {
  const router = useRouter();
  const {status, isAuthenticated, deviceIds} = useAuth();
  const [showLogo, setShowLogo] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowLogo(false), 750);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showLogo || status === 'loading' || !isAuthenticated) return;
    router.replace(getPostAuthRoute(deviceIds));
  }, [deviceIds, isAuthenticated, router, showLogo, status]);

  if (showLogo || status === 'loading') {
    return (
      <SafeAreaView style={styles.logoScreen} edges={['top', 'left', 'right']}>
        <Image
          source={require('../../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </SafeAreaView>
    );
  }

  return <AuthScreen />;
}

const styles = StyleSheet.create({
  logoScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  logo: {width: 160, height: 160, marginTop: -spacing.sm},
});
