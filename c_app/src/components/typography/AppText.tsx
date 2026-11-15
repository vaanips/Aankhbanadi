import React, { useMemo } from 'react';
import { StyleSheet, Text, TextProps, TextStyle } from 'react-native';
import { scaledFontSize } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export type AppTextVariant = 'title' | 'body' | 'caption' | 'label';

interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  color?: 'primary' | 'secondary' | 'danger' | 'success' | 'inherit';
  children: React.ReactNode;
}

const variantToTypography: Record<
  AppTextVariant,
  { fontSize: number; lineHeight: number; fontWeight: TextStyle['fontWeight'] }
> = {
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
};

export function AppText({
  variant = 'body',
  color = 'inherit',
  style,
  children,
  allowFontScaling = true,
  ...rest
}: AppTextProps): React.JSX.Element {
  const { theme } = useTheme();
  const base = variantToTypography[variant];

  const textStyle = useMemo(() => {
    const fontSize = scaledFontSize(base.fontSize, theme.largeText);
    const lineHeight = scaledFontSize(base.lineHeight, theme.largeText);
    let textColor = theme.colors.text;
    if (color === 'secondary') {
      textColor = theme.colors.textSecondary;
    } else if (color === 'danger') {
      textColor = theme.colors.danger;
    } else if (color === 'success') {
      textColor = theme.colors.success;
    } else if (color === 'primary') {
      textColor = theme.colors.primary;
    }
    return {
      fontSize,
      lineHeight,
      fontWeight: base.fontWeight,
      color: textColor,
    } as TextStyle;
  }, [base, color, theme]);

  return (
    <Text style={[textStyle, style]} allowFontScaling={allowFontScaling} {...rest}>
      {children}
    </Text>
  );
}