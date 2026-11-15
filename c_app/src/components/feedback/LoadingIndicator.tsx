import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '../typography/AppText';
import { useTheme } from '../../theme/ThemeProvider';

interface LoadingIndicatorProps {
  label?: string;
  size?: 'small' | 'large';
}

export function LoadingIndicator({
  label = 'Loading',
  size = 'large',
}: LoadingIndicatorProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}>
      <ActivityIndicator size={size} color={theme.colors.primary} />
      {label ? (
        <AppText variant="caption" color="secondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  label: {
    textAlign: 'center',
  },
});