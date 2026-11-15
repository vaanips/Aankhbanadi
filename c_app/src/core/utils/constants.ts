export const APP_NAME = 'Drishti';
export const TAGLINE = 'Your AI vision assistant';

/** Demo mode uses mock detections — not real on-device YOLO */
/** False when phone uses the laptop YOLO server. */
export const DEMO_MODE = false;

export const STARTUP_ANNOUNCEMENTS = [
  `${APP_NAME} is ready.`,
  'Voice commands and demo scene descriptions are available.',
  'Say "help" anytime to hear what I can do.',
] as const;

export const STORAGE_KEYS = {
  settings: '@drishti/settings',
  activity: '@drishti/activity',
  onboardingComplete: '@drishti/onboarding_complete',
  startupAnnounced: '@drishti/startup_announced',
  udidAuth: '@drishti/udid_auth',
} as const;

/** Hold ID still this long while capturing frames. */
export const UDID_HOLD_STILL_MS = 2000;
/** Capture interval during the hold window only (server keeps the sharpest). */
export const UDID_FRAME_INTERVAL_MS = 500;

export const VOICE_LISTEN_TIMEOUT_MS = 12_000;
export const MOCK_DETECTION_INTERVAL_MS = 3_500;
export const MAX_ACTIVITY_ENTRIES = 200;