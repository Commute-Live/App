import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export default function IslandSuccess({
  visible,
  title,
  subtitle,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {duration: visible ? 220 : 160});
  }, [progress, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{translateY: interpolate(progress.value, [0, 1], [-8, 0])}],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.wrapper, animatedStyle]}>
      <View style={styles.island}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark" size={14} color="#F8FAFC" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} selectable>
            {title}
          </Text>
          <Text style={styles.subtitle} selectable>
            {subtitle}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  island: {
    minWidth: 184,
    maxWidth: 260,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0B0C0E',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 6,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1E8F5E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(248, 250, 252, 0.72)',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
});
