import { TextStyle } from 'react-native';

/**
 * Font sizes are chosen for accessibility (WCAG-friendly hierarchy).
 * All Text components consuming these styles should set allowFontScaling={true}
 * so users can respect system font size / accessibility settings.
 */
export const typography = {
  /** allowFontScaling: recommended true — scales with OS accessibility text size */
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as TextStyle['fontWeight'],
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700' as TextStyle['fontWeight'],
  },
  heading: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as TextStyle['fontWeight'],
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as TextStyle['fontWeight'],
  },
  bodyLarge: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '400' as TextStyle['fontWeight'],
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as TextStyle['fontWeight'],
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as TextStyle['fontWeight'],
  },
  button: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as TextStyle['fontWeight'],
  },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Multiplier when largeText accessibility setting is enabled in the app */
export const LARGE_TEXT_SCALE = 1.2;

export function scaledFontSize(baseSize: number, largeText: boolean): number {
  return largeText ? Math.round(baseSize * LARGE_TEXT_SCALE) : baseSize;
}