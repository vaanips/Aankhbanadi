import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../typography/AppText';
import { useTheme } from '../../theme/ThemeProvider';

export function DemoModeBanner(): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <View
      style={[styles.banner, { backgroundColor: theme.colors.warning, borderColor: theme.colors.navy }]}
      accessibilityRole="alert"
      accessibilityLabel="Demo mode is active. Scene data is simulated, not live vision.">
      <AppText variant="label" style={{ color: theme.colors.navy }}>
        DEMO MODE
      </AppText>
      <AppText variant="caption" style={{ color: theme.colors.navy, marginTop: 2 }}>
        Using sample scene data — not live vision
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});