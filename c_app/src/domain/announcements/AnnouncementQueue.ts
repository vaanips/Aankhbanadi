import { SpeechPriority, SPEECH_PRIORITY_ORDER } from '../../core/types/voice.types';

export interface AnnouncementItem {
  id: string;
  text: string;
  priority: SpeechPriority;
  createdAt: number;
  dedupeKey?: string;
  scope?: string;
}

function generateId(): string {
  return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export class AnnouncementQueue {
  private items: AnnouncementItem[] = [];

  enqueue(
    text: string,
    priority: SpeechPriority = 'normal',
    dedupeKey?: string,
    scope?: string,
  ): AnnouncementItem | null {
    const normalized = text.trim();
    if (!normalized) {
      return null;
    }
    const key = dedupeKey ?? normalized.toLowerCase();
    if (this.items.some(item => (item.dedupeKey ?? item.text.toLowerCase()) === key)) {
      return null;
    }
    const item: AnnouncementItem = {
      id: generateId(),
      text: normalized,
      priority,
      createdAt: Date.now(),
      dedupeKey: key,
      scope,
    };
    this.items.push(item);
    this.sort();
    return item;
  }

  dequeue(): AnnouncementItem | undefined {
    return this.items.shift();
  }

  peek(): AnnouncementItem | undefined {
    return this.items[0];
  }

  clearLowPriority(): void {
    this.items = this.items.filter(
      item => SPEECH_PRIORITY_ORDER[item.priority] >= SPEECH_PRIORITY_ORDER.normal,
    );
  }

  clear(): void {
    this.items = [];
  }

  clearScope(scope: string): void {
    this.items = this.items.filter(item => item.scope !== scope);
  }

  removeDuplicates(): void {
    const seen = new Set<string>();
    this.items = this.items.filter(item => {
      const key = item.dedupeKey ?? item.text.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  size(): number {
    return this.items.length;
  }

  snapshot(): AnnouncementItem[] {
    return [...this.items];
  }

  private sort(): void {
    this.items.sort(
      (a, b) =>
        SPEECH_PRIORITY_ORDER[b.priority] - SPEECH_PRIORITY_ORDER[a.priority] ||
        a.createdAt - b.createdAt,
    );
  }
}