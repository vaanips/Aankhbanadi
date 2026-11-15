import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppText } from '../typography/AppText';
import { useTheme } from '../../theme/ThemeProvider';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function Header({ title, subtitle, showBack, onBack }: HeaderProps): React.JSX.Element {
  const { theme } = useTheme();
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.container, { borderBottomColor: theme.colors.border }]}>
      {showBack ? (
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backButton,
            { minHeight: theme.minTouchTarget, minWidth: theme.minTouchTarget },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}>
          <AppText variant="label" style={{ color: theme.colors.primary }}>
            ← Back
          </AppText>
        </Pressable>
      ) : (
        <View style={styles.backPlaceholder} />
      )}
      <View style={styles.titleBlock} accessibilityRole="header">
        <AppText variant="title" style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    justifyContent: 'center',
    marginBottom: 4,
  },
  backPlaceholder: {
    height: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    marginBottom: 0,
  },
});