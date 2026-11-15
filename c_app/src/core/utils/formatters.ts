export function capitalize(text: string): string {
  if (!text) {
    return '';
  }
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function pluralize(word: string, count: number): string {
  if (count === 1) {
    return word;
  }
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
    return `${word}es`;
  }
  if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }
  if (word === 'person') {
    return 'people';
  }
  return `${word}s`;
}

export function formatStepsText(steps: number | undefined): string {
  if (steps === undefined || Number.isNaN(steps)) {
    return 'an unknown distance';
  }
  const rounded = Math.max(1, Math.round(steps));
  if (rounded === 1) {
    return 'about one step away';
  }
  return `about ${rounded} steps away`;
}

export function formatDistanceMeters(meters: number | undefined): string {
  if (meters === undefined || Number.isNaN(meters)) {
    return 'unknown distance';
  }
  if (meters < 1) {
    return 'less than one meter';
  }
  return `about ${meters.toFixed(1)} meters`;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  if (diff < MINUTE) {
    return 'just now';
  }
  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(diff / DAY);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}