import { createLogger } from '../utils/logger';

const log = createLogger('HapticService');

type HapticImpact = 'light' | 'medium' | 'heavy';

let ReactNativeHapticFeedback: {
  trigger: (type: string, options?: { enableVibrateFallback?: boolean }) => void;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('react-native-haptic-feedback');
  ReactNativeHapticFeedback = module.default ?? module;
} catch (error) {
  log.warn('Haptic feedback module unavailable', error);
}

const IMPACT_MAP: Record<HapticImpact, string> = {
  light: 'impactLight',
  medium: 'impactMedium',
  heavy: 'impactHeavy',
};

let hapticEnabled = true;

export const HapticService = {
  setEnabled(enabled: boolean): void {
    hapticEnabled = enabled;
  },

  trigger(impact: HapticImpact = 'light'): void {
    if (!hapticEnabled || !ReactNativeHapticFeedback) {
      return;
    }
    try {
      ReactNativeHapticFeedback.trigger(IMPACT_MAP[impact], {
        enableVibrateFallback: true,
      });
    } catch (error) {
      log.warn('trigger failed', error);
    }
  },

  light(): void {
    this.trigger('light');
  },

  medium(): void {
    this.trigger('medium');
  },
};