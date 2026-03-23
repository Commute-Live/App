import React, {useEffect, useState} from 'react';
import {Image, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {colors} from '../../../theme';
import {useAuth} from '../../../state/authProvider';

export default function MainEntryScreen() {
  const router = useRouter();
  const {status, isAuthenticated, deviceIds} = useAuth();
  const [showLogo, setShowLogo] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowLogo(false), 750);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showLogo || status === 'loading') return;

    if (!isAuthenticated) {
      router.replace('/auth');
      return;
    }

    if (deviceIds.length === 0) {
      router.replace({pathname: '/auth', params: {resume: 'device'}});
      return;
    }

    router.replace('/dashboard');
  }, [deviceIds.length, isAuthenticated, router, showLogo, status]);

  if (showLogo || status === 'loading') {
    return (
      <SafeAreaView style={styles.logoScreen} edges={['top', 'left', 'right']}>
        <Image
          source={require('../../../assets/images/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  logoScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {width: 160, height: 160},
});
