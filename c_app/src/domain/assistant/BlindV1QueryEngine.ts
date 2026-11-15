/**
 * Exact voice-query behaviour from blind_v1.py
 * (parse_step_query + listen_for_voice_query response building).
 */

import { Detection } from '../../core/types/detection.types';

const STEP_LENGTH_METERS = 0.65;

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

/** Speakable groups first, then COCO class names (longest-first match). */
const KNOWN_NAMES = [
  'sports equipment',
  'kitchen item',
  'road signal',
  'electronic',
  'electronics',
  'furniture',
  'obstacle',
  'vehicle',
  'animal',
  'person',
  'people',
  'dining table',
  'traffic light',
  'fire hydrant',
  'parking meter',
  'sports ball',
  'baseball bat',
  'baseball glove',
  'tennis racket',
  'potted plant',
  'cell phone',
  'wine glass',
  'stop sign',
  'microwave',
  'refrigerator',
  'skateboard',
  'surfboard',
  'snowboard',
  'motorcycle',
  'toothbrush',
  'hair drier',
  'teddy bear',
  'laptop',
  'keyboard',
  'remote',
  'mouse',
  'bottle',
  'umbrella',
  'handbag',
  'backpack',
  'suitcase',
  'bicycle',
  'chair',
  'couch',
  'bench',
  'toilet',
  'train',
  'truck',
  'bus',
  'car',
  'bird',
  'cat',
  'dog',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',
  'bed',
  'tv',
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'oven',
  'toaster',
  'sink',
  'frisbee',
  'skis',
  'book',
  'clock',
  'vase',
  'scissors',
  'banana',
  'apple',
  'sandwich',
  'orange',
  'broccoli',
  'carrot',
  'hot dog',
  'pizza',
  'donut',
  'cake',
].sort((a, b) => b.length - a.length);

const ELECTRONIC_CLASSES = new Set([
  'tv',
  'laptop',
  'mouse',
  'remote',
  'keyboard',
  'cell phone',
]);

const GROUP_TO_CLASSES: Record<string, Set<string>> = {
  electronic: ELECTRONIC_CLASSES,
  electronics: ELECTRONIC_CLASSES,
  furniture: new Set(['chair', 'couch', 'bed', 'dining table', 'toilet', 'bench']),
  vehicle: new Set(['bicycle', 'car', 'motorcycle', 'bus', 'train', 'truck']),
  animal: new Set([
    'bird',
    'cat',
    'dog',
    'horse',
    'sheep',
    'cow',
    'elephant',
    'bear',
    'zebra',
    'giraffe',
  ]),
  'kitchen item': new Set([
    'bottle',
    'wine glass',
    'cup',
    'fork',
    'knife',
    'spoon',
    'bowl',
    'microwave',
    'oven',
    'toaster',
    'sink',
    'refrigerator',
  ]),
  'road signal': new Set(['traffic light', 'stop sign']),
  'sports equipment': new Set([
    'sports ball',
    'baseball bat',
    'baseball glove',
    'skateboard',
    'surfboard',
    'tennis racket',
    'frisbee',
    'skis',
    'snowboard',
  ]),
  obstacle: new Set([
    'fire hydrant',
    'parking meter',
    'potted plant',
    'suitcase',
    'backpack',
    'handbag',
    'umbrella',
  ]),
  person: new Set(['person']),
};

const START_WORDS = new Set(['start', 'announcements', 'resume', 'please']);
const STOP_WORDS = new Set(['stop', 'announcements', 'pause', 'please']);

export type BlindV1Direction = 'left' | 'right' | 'ahead';

export interface BlindV1ParsedQuery {
  maxSteps: number | null;
  direction: BlindV1Direction | null;
  requestedName: string | null;
  cleanText: string;
  isYesNo: boolean;
}

export interface BlindV1Answer {
  spokenText: string;
  enableAnnouncements?: boolean;
  disableAnnouncements?: boolean;
}

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distanceToSteps(distanceM?: number | null): number | null {
  if (distanceM == null || distanceM <= 0 || !Number.isFinite(distanceM)) {
    return null;
  }
  return Math.max(1, Math.round(distanceM / STEP_LENGTH_METERS));
}

/** Map app Detection.direction (left|center|right) → blind_v1 ahead/left/right. */
function detectionDirection(d: Detection): BlindV1Direction {
  const raw = (d as Detection & { direction_raw?: string }).direction_raw;
  if (raw === 'left' || raw === 'right' || raw === 'ahead') {
    return raw;
  }
  if (d.direction === 'left') {
    return 'left';
  }
  if (d.direction === 'right') {
    return 'right';
  }
  return 'ahead';
}

function detectionClassName(d: Detection): string {
  return (d.className || '').toLowerCase();
}

/** Prefer group phrase so speech says "electronic" not "laptop". */
function detectionSpeakName(d: Detection): string {
  const phrase = (d.groupPhrase || '').toLowerCase().trim();
  if (phrase) {
    return phrase;
  }
  const category = (d.category || '').toLowerCase();
  if (category === 'electronics' || category === 'electronic') {
    return 'electronic';
  }
  if (category) {
    return category;
  }
  return detectionClassName(d) || 'object';
}

function detectionMatchesRequest(d: Detection, requestedName: string | null): boolean {
  if (!requestedName) {
    return true;
  }
  const req = requestedName.toLowerCase();
  const className = detectionClassName(d);
  if (className === req) {
    return true;
  }
  const groupClasses = GROUP_TO_CLASSES[req];
  if (groupClasses && groupClasses.has(className)) {
    return true;
  }
  // Asking for laptop/phone should also match electronic group speech
  if (
    (req === 'laptop' ||
      req === 'tv' ||
      req === 'keyboard' ||
      req === 'mouse' ||
      req === 'remote' ||
      req === 'cell phone') &&
    ELECTRONIC_CLASSES.has(className)
  ) {
    return true;
  }
  return detectionSpeakName(d) === req;
}

function detectionDistance(d: Detection): number | null {
  if (d.estimatedDistanceMeters != null && Number.isFinite(d.estimatedDistanceMeters)) {
    return d.estimatedDistanceMeters;
  }
  return null;
}

export function parseStepQuery(query: string): BlindV1ParsedQuery {
  const text = normalizeQuery(query);

  let maxSteps: number | null = null;
  const digitMatch = text.match(/\b(\d+)\s*steps?\b/);
  if (digitMatch) {
    maxSteps = parseInt(digitMatch[1], 10);
  } else {
    for (const [word, value] of Object.entries(NUMBER_WORDS)) {
      if (new RegExp(`\\b${word}\\s+steps?\\b`).test(text)) {
        maxSteps = value;
        break;
      }
    }
  }

  let direction: BlindV1Direction | null = null;
  if (/\b(left|on my left|to my left)\b/.test(text)) {
    direction = 'left';
  } else if (/\b(right|on my right|to my right)\b/.test(text)) {
    direction = 'right';
  } else if (/\b(ahead|in front|front|in front of me|straight ahead)\b/.test(text)) {
    direction = 'ahead';
  }

  let requestedName: string | null = null;
  for (const name of KNOWN_NAMES) {
    if (name === 'people') {
      continue;
    }
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}s?\\b`).test(text)) {
      requestedName = name;
      break;
    }
  }
  if (/\bpeople\b/.test(text)) {
    requestedName = 'person';
  }

  const isYesNo = /^(is there|are there|do you see|can you see|is a|are any)\b/.test(text);

  return { maxSteps, direction, requestedName, cleanText: text, isYesNo };
}

function parseAnnouncementCommand(text: string): 'start' | 'stop' | null {
  const words = text.split(' ').filter(Boolean);
  if (!words.length) {
    return null;
  }
  // blind_v1 exact logic (operator precedence mirrors Python `and`/`or`)
  const startCmd =
    (words.length > 0 &&
      words.every(w => START_WORDS.has(w)) &&
      words.includes('start')) ||
    (words.length === 2 && words[0] === 'resume' && words[1] === 'announcements');
  const stopCmd =
    (words.length > 0 &&
      words.every(w => STOP_WORDS.has(w)) &&
      words.includes('stop')) ||
    (words.length === 2 && words[0] === 'pause' && words[1] === 'announcements');

  // Also accept bare "start" / "stop" / "pause" / "resume"
  if (words.length === 1 && words[0] === 'start') {
    return 'start';
  }
  if (words.length === 1 && (words[0] === 'stop' || words[0] === 'pause')) {
    return 'stop';
  }
  if (words.length === 1 && words[0] === 'resume') {
    return 'start';
  }
  if (startCmd) {
    return 'start';
  }
  if (stopCmd) {
    return 'stop';
  }
  return null;
}

function nounFor(name: string, count: number): string {
  if (name === 'person') {
    return count === 1 ? 'person' : 'people';
  }
  if (name === 'electronic' || name === 'electronics') {
    return count === 1 ? 'electronic' : 'electronics';
  }
  if (name === 'furniture') {
    return count === 1 ? 'furniture' : 'furniture';
  }
  if (name.endsWith('s')) {
    return name;
  }
  return count === 1 ? name : `${name}s`;
}

/**
 * Full blind_v1 listen_for_voice_query answer builder.
 */
export function answerVoiceQuery(
  query: string,
  detections: Detection[],
): BlindV1Answer {
  const clean = normalizeQuery(query);
  if (!clean) {
    return { spokenText: 'Sorry, I could not understand. Please try again.' };
  }

  const announcement = parseAnnouncementCommand(clean);
  if (announcement === 'start') {
    return {
      spokenText: 'Automatic announcements started.',
      enableAnnouncements: true,
    };
  }
  if (announcement === 'stop') {
    return {
      spokenText: 'Automatic announcements stopped.',
      disableAnnouncements: true,
    };
  }

  const { maxSteps, direction, requestedName, isYesNo } = parseStepQuery(query);

  type Match = { steps: number | null; item: Detection; name: string; dir: BlindV1Direction };
  const matches: Match[] = [];

  for (const item of detections) {
    if (!detectionMatchesRequest(item, requestedName)) {
      continue;
    }
    const dir = detectionDirection(item);
    if (direction && dir !== direction) {
      continue;
    }
    const distance = detectionDistance(item);
    const steps = distanceToSteps(distance);
    if (maxSteps != null && (steps == null || steps > maxSteps)) {
      continue;
    }
    // Always speak the group name (electronic), not YOLO class (laptop)
    const name = detectionSpeakName(item);
    matches.push({ steps, item, name, dir });
  }

  let response: string;

  if (isYesNo) {
    const subject =
      requestedName === 'laptop' ||
      requestedName === 'tv' ||
      requestedName === 'cell phone' ||
      requestedName === 'keyboard' ||
      requestedName === 'mouse' ||
      requestedName === 'remote' ||
      requestedName === 'electronics'
        ? 'electronic'
        : requestedName || 'object';
    if (matches.length === 0) {
      response = `No, I don't detect a ${subject}`;
      response += direction ? ` ${direction}.` : ' nearby.';
    } else {
      const count = matches.length;
      const noun = nounFor(subject, count);
      const where = direction || matches[0].dir;
      response = `Yes, there ${count === 1 ? 'is' : 'are'} ${
        count > 1 ? count : 'a'
      } ${noun} ${where}.`;
    }
  } else if (matches.length === 0) {
    const scope = direction ? ` ${direction}` : ' around you';
    if (maxSteps != null) {
      response = `I don't detect any objects within ${maxSteps} steps${scope}.`;
    } else {
      response = `I don't detect any matching objects${scope}.`;
    }
  } else {
    const grouped = new Map<string, { name: string; where: BlindV1Direction; steps: number | null; count: number }>();
    for (const m of matches) {
      const key = `${m.name}|${m.dir}|${m.steps ?? 'x'}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        grouped.set(key, {
          name: m.name,
          where: m.dir,
          steps: m.steps,
          count: 1,
        });
      }
    }

    const parts = Array.from(grouped.values())
      .sort(
        (a, b) =>
          (a.steps ?? 999) - (b.steps ?? 999) || a.name.localeCompare(b.name),
      )
      .slice(0, 6)
      .map(entry => {
        const noun = nounFor(entry.name, entry.count);
        const distancePhrase =
          entry.steps != null ? ` approximately ${entry.steps} steps` : '';
        return `${entry.count} ${noun}${distancePhrase} ${entry.where}`;
      });

    response = `Yes. I detect ${parts.join('; and ')}.`;
  }

  return { spokenText: response };
}

export const BlindV1QueryEngine = {
  parseStepQuery,
  answerVoiceQuery,
};
