import type { Intent } from '../../core/types/voice.types';

export function parseIntent(rawText: string): Intent {
  const query = rawText.trim();
  const text = query.toLowerCase().replace(/[.!?]/g, '').trim();
  if (!text) {
    return { type: 'unknown', query };
  }
  if (/\b(help|what can you do|commands)\b/.test(text)) return { type: 'help' };
  if (/\b(go to home|go home|start drishti)\b/.test(text)) return { type: 'go-home' };
  if (/\b(open|go to) settings\b/.test(text)) return { type: 'open-settings' };
  if (/\b(start|open) (the )?(camera|camera assistance)\b/.test(text)) {
    return { type: 'open-camera' };
  }
  if (/\b(stop|close) (the )?(camera|camera assistance|assistance)\b/.test(text)) {
    return { type: 'stop-camera' };
  }
  if (/\b(start|enable|resume) announcements\b/.test(text)) {
    return { type: 'enable-announcements' };
  }
  if (/\b(stop|disable|pause) announcements\b/.test(text)) {
    return { type: 'disable-announcements' };
  }
  if (/\b(repeat|say that again|repeat that)\b/.test(text)) {
    return { type: 'repeat-response' };
  }
  if (/\b(what|where|is there|are there|describe|tell me|can you see)\b/.test(text)) {
    return { type: 'query', query };
  }
  return { type: 'unknown', query };
}
