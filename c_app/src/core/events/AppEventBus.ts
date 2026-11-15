export type AppEventMap = {
  'voice:state': { state: string };
  'camera:detections': { count: number };
  'announcements:paused': { paused: boolean };
  'settings:updated': { key: string };
  'assistant:response': { text: string };
};

type EventKey = keyof AppEventMap;
type Listener<K extends EventKey> = (payload: AppEventMap[K]) => void;

class TypedEventBus {
  private listeners = new Map<EventKey, Set<Listener<EventKey>>>();

  subscribe<K extends EventKey>(event: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<EventKey>);
    return () => this.unsubscribe(event, listener);
  }

  unsubscribe<K extends EventKey>(event: K, listener: Listener<K>): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }
    set.delete(listener as Listener<EventKey>);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<K extends EventKey>(event: K, payload: AppEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }
    [...set].forEach(listener => {
      try {
        listener(payload);
      } catch (error) {
        console.warn(`[AppEventBus] listener error for ${event}`, error);
      }
    });
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const appEventBus = new TypedEventBus();