import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeProvider';

interface ListeningPulseProps {
  active: boolean;
}

export function ListeningPulse({ active }: ListeningPulseProps): React.JSX.Element | null {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withTiming(1.35, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      opacity.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(0.35, { duration: 200 });
    }
  }, [active, opacity, scale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!active) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={[
          styles.ring,
          ringStyle,
          { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryMuted },
        ]}
      />
      <View style={[styles.core, { backgroundColor: theme.colors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
  },
  core: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});