import React from 'react';
import { StyleSheet, Text, View, type PropsWithChildren } from 'react-native';
import { useSettingsStore } from '../core/state/settingsStore';
import { colors } from '../theme/colors';

interface CardProps extends PropsWithChildren {
  title?: string;
  description?: string;
}

export function Card({ title, description, children }: CardProps) {
  const dark = useSettingsStore(state => state.theme === 'dark');
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: dark ? colors.darkSurface : colors.surface,
          borderColor: dark ? '#334155' : colors.border,
        },
      ]}>
      {title ? (
        <Text style={[styles.title, { color: dark ? colors.darkText : colors.text }]}>
          {title}
        </Text>
      ) : null}
      {description ? (
        <Text style={[styles.description, { color: dark ? colors.darkSecondaryText : colors.secondaryText }]}>
          {description}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  description: { color: colors.secondaryText, fontSize: 15, lineHeight: 22 },
});
