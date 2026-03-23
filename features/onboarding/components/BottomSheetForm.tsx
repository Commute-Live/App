import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type KeyboardEvent,
  type TextInputProps,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {onboardingPalette} from '../constants';

const iosKeyboardEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

export function BottomSheetTextInputField(props: TextInputProps) {
  return <TextInput {...props} />;
}

export default function BottomSheetForm({
  visible,
  title,
  subtitle,
  onDismiss,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  onDismiss: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      translateY.stopAnimation();
      translateY.setValue(0);
      return;
    }

    const animateTo = (nextValue: number, duration: number, easing: (value: number) => number) => {
      Animated.timing(translateY, {
        toValue: nextValue,
        duration,
        easing,
        useNativeDriver: true,
      }).start();
    };

    const handleShow = (event: KeyboardEvent) => {
      const overlap =
        Platform.OS === 'ios'
          ? Math.max(0, height - event.endCoordinates.screenY - insets.bottom - 10)
          : Math.max(0, event.endCoordinates.height - insets.bottom);
      animateTo(-overlap, Math.max(event.duration ?? 320, 220), iosKeyboardEasing);
    };

    const handleHide = (event?: KeyboardEvent) => {
      animateTo(
        0,
        Math.max(event?.duration ?? 260, 200),
        Platform.OS === 'ios' ? iosKeyboardEasing : Easing.out(Easing.quad),
      );
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, handleShow);
    const hideSub = Keyboard.addListener(hideEvent, handleHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [height, insets.bottom, translateY, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Animated.View
          style={[
            styles.sheetWrap,
            {
              transform: [{translateY}],
            },
          ]}>
          <View
            style={[
              styles.sheet,
              {
                maxHeight: Math.min(height * 0.78, 540),
                paddingBottom: Math.max(insets.bottom, 18),
              },
            ]}>
            <View style={styles.handle} />
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
              <Text style={styles.title} selectable>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} selectable>
                  {subtitle}
                </Text>
              ) : null}
              <View style={styles.children}>{children}</View>
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(3, 3, 3, 0.30)',
  },
  sheetWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: onboardingPalette.borderStrong,
    backgroundColor: onboardingPalette.surfaceStrong,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 4,
    backgroundColor: onboardingPalette.borderStrong,
    marginTop: 10,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 8,
  },
  title: {
    color: onboardingPalette.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    color: onboardingPalette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  children: {
    marginTop: 18,
    gap: 14,
  },
  footer: {
    marginTop: 18,
  },
});
