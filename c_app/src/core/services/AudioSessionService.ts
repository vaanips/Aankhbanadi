import { createLogger } from '../utils/logger';

const log = createLogger('AudioSessionService');

/**
 * Coordinates audio focus between announcements, TTS responses, and listening.
 * Native audio session wiring can be added in a later phase.
 */
class AudioSessionServiceImpl {
  private announcementsPausedForListening = false;
  private duckingEnabled = true;

  pauseAnnouncementsForListening(): void {
    if (this.announcementsPausedForListening) {
      return;
    }
    this.announcementsPausedForListening = true;
    log.debug('Announcements paused for listening');
  }

  resumeAnnouncementsAfterListening(): void {
    if (!this.announcementsPausedForListening) {
      return;
    }
    this.announcementsPausedForListening = false;
    log.debug('Announcements resumed after listening');
  }

  areAnnouncementsPausedForListening(): boolean {
    return this.announcementsPausedForListening;
  }

  setDuckingEnabled(enabled: boolean): void {
    this.duckingEnabled = enabled;
  }

  isDuckingEnabled(): boolean {
    return this.duckingEnabled;
  }
}

export const AudioSessionService = new AudioSessionServiceImpl();