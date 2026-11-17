jest.mock('../../core/services/TextToSpeechService', () => ({
  TextToSpeechService: {
    setRate: jest.fn().mockResolvedValue(undefined),
    setVolume: jest.fn(),
    speak: jest.fn().mockResolvedValue('speech-id'),
    stop: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../core/services/AudioSessionService', () => ({
  AudioSessionService: {
    areAnnouncementsPausedForListening: jest.fn(() => false),
  },
}));

jest.mock('../../core/state/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({ voiceEnabled: true, speechRate: 0.5, speechVolume: 1 }),
  },
}));

jest.mock('../../core/state/voiceStore', () => ({
  useVoiceStore: {
    getState: () => ({
      setAnnouncementsEnabled: jest.fn(),
      setAnnouncementsPaused: jest.fn(),
    }),
  },
}));

import { TextToSpeechService } from '../../core/services/TextToSpeechService';
import { AnnouncementManager } from './AnnouncementManager';

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('AnnouncementManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts speaking again after announcements are disabled and re-enabled', async () => {
    const manager = new AnnouncementManager();
    manager.announce('First announcement');
    await flushPromises();
    manager.disable();

    manager.enable();
    manager.announce('Announcement after restart');
    await flushPromises();

    expect(TextToSpeechService.speak).toHaveBeenCalledTimes(2);
    expect(TextToSpeechService.speak).toHaveBeenLastCalledWith(
      'Announcement after restart',
      'normal',
      expect.objectContaining({ onCancel: expect.any(Function) }),
    );
  });

  it('cancels the previous frame announcement when a newer frame arrives', async () => {
    const manager = new AnnouncementManager();
    manager.announceLatest('Old object', 'normal', 'camera:old', 'camera-detection');
    await flushPromises();

    manager.announceLatest('New object', 'normal', 'camera:new', 'camera-detection');
    await flushPromises();

    expect(TextToSpeechService.cancel).toHaveBeenCalledWith('speech-id');
    expect(TextToSpeechService.speak).toHaveBeenCalledTimes(2);
  });
});
