/** Minimum touch target per WCAG / platform guidance (dp) */
export const MIN_TOUCH_TARGET = 48;

export function meetsMinTouchSize(size: number): boolean {
  return size >= MIN_TOUCH_TARGET;
}

/**
 * Relative luminance (sRGB) for contrast ratio checks.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) {
    return null;
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return null;
  }
  return { r, g, b };
}

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number | null {
  const l1 = relativeLuminance(foregroundHex);
  const l2 = relativeLuminance(backgroundHex);
  if (l1 === null || l2 === null) {
    return null;
  }
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA normal text requires >= 4.5:1 */
export function meetsWcagAaContrast(
  foregroundHex: string,
  backgroundHex: string,
  minRatio = 4.5,
): boolean {
  const ratio = contrastRatio(foregroundHex, backgroundHex);
  return ratio !== null && ratio >= minRatio;
}