import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PropsWithChildren,
} from 'react-native';
import { useSettingsStore } from '../core/state/settingsStore';
import { colors } from '../theme/colors';

interface ScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  scroll?: boolean;
}

export function Screen({ title, subtitle, scroll = true, children }: ScreenProps) {
  const { theme, largeText, highContrast } = useSettingsStore();
  const dark = theme === 'dark';
  const background = dark ? colors.darkBackground : colors.background;
  const text = dark ? colors.darkText : colors.text;
  const content = (
    <View style={[styles.content, { backgroundColor: background }]}>
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          style={[
            styles.title,
            { color: highContrast ? '#000000' : text },
            largeText && styles.largeTitle,
          ]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: dark ? colors.darkSecondaryText : colors.secondaryText }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
  return scroll ? (
    <ScrollView
      style={{ backgroundColor: background }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled">
      {content}
    </ScrollView>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  content: { flex: 1, padding: 22, gap: 18 },
  heading: { gap: 6, marginBottom: 4 },
  title: { color: colors.text, fontSize: 29, fontWeight: '800' },
  largeTitle: { fontSize: 34 },
  subtitle: { color: colors.secondaryText, fontSize: 16, lineHeight: 23 },
});
