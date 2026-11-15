import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeProvider';

interface SpeakingBarsProps {
  active: boolean;
}

const BAR_COUNT = 5;
const BAR_HEIGHTS = [16, 28, 22, 30, 18];

function SpeakingBar({ index, active, color }: { index: number; active: boolean; color: string }) {
  const height = useSharedValue(BAR_HEIGHTS[index]);

  useEffect(() => {
    if (active) {
      height.value = withRepeat(
        withSequence(
          withTiming(BAR_HEIGHTS[index] + 14, {
            duration: 280 + index * 40,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(BAR_HEIGHTS[index], {
            duration: 280 + index * 40,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      );
    } else {
      height.value = withTiming(BAR_HEIGHTS[index], { duration: 200 });
    }
  }, [active, height, index]);

  const barStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return <Animated.View style={[styles.bar, barStyle, { backgroundColor: color }]} />;
}

export function SpeakingBars({ active }: SpeakingBarsProps): React.JSX.Element | null {
  const { theme } = useTheme();

  if (!active) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessibilityLabel="Assistant is speaking"
      accessibilityRole="image">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <SpeakingBar key={i} index={i} active={active} color={theme.colors.primary} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    height: 40,
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
});