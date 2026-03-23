import React, {useEffect} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {ONBOARDING_STAGGER_MS} from '../constants';

export default function StaggeredEntrance({
  animateKey,
  index,
  children,
  style,
}: {
  animateKey: string;
  index: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const translateY = useSharedValue(10);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = index * ONBOARDING_STAGGER_MS;

    translateY.value = 10;
    opacity.value = 0;

    translateY.value = withDelay(delay, withTiming(0, {duration: 220}));
    opacity.value = withDelay(delay, withTiming(1, {duration: 180}));
  }, [animateKey, index, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{translateY: translateY.value}],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
