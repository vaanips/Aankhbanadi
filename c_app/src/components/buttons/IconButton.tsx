import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { AppText } from '../typography/AppText';
import { HapticService } from '../../core/services/HapticService';
import { useSettingsStore } from '../../core/state/settingsStore';
import { useTheme } from '../../theme/ThemeProvider';

interface IconButtonProps {
  icon: string;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

const ICON_BUTTON_SIZE = 52;

export function IconButton({
  icon,
  onPress,
  onPressIn,
  onPressOut,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  style,
}: IconButtonProps): React.JSX.Element {
  const { theme } = useTheme();
  const hapticEnabled = useSettingsStore(state => state.hapticEnabled);

  const handlePress = () => {
    if (disabled) {
      return;
    }
    if (hapticEnabled) {
      HapticService.light();
    }
    onPress();
  };

  const size = Math.max(ICON_BUTTON_SIZE, theme.minTouchTarget);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}>
      <AppText variant="title" style={styles.icon}>
        {icon}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    textAlign: 'center',
  },
});