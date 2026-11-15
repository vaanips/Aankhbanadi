import { textToSpeechService } from './TextToSpeechService';

type Announcement = { text: string; priority: number };

class AnnouncementManager {
  private queue: Announcement[] = [];
  private running = false;

  enqueue(text: string, priority = 0): void {
    if (!text.trim()) return;
    if (priority > 0) this.queue = this.queue.filter(item => item.priority >= priority);
    this.queue.push({ text, priority });
    this.queue.sort((left, right) => right.priority - left.priority);
    void this.process();
  }

  clear(): void {
    this.queue = [];
    void textToSpeechService.stop();
  }

  private async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const next = this.queue.shift();
        if (next) await textToSpeechService.speak(next.text);
      }
    } finally {
      this.running = false;
    }
  }
}

export const announcementManager = new AnnouncementManager();
