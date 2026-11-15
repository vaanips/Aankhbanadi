import { ParsedIntent, AssistantIntentType } from '../../core/types/assistant.types';
import { DetectionDirection } from '../../core/types/detection.types';

const NORMALIZE = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const OBJECT_ALIASES: Record<string, string> = {
  human: 'person',
  somebody: 'person',
  someone: 'person',
  folks: 'person',
  chair: 'chair',
  seat: 'chair',
  bottle: 'bottle',
  cup: 'cup',
  door: 'door',
  obstacle: 'obstacle',
  hazard: 'obstacle',
};

/** Same allowed vocabulary as blind_v1 start/stop announcement commands. */
const START_WORDS = new Set(['start', 'announcements', 'resume', 'please', 'automatic']);
const STOP_WORDS = new Set(['stop', 'announcements', 'pause', 'please', 'automatic']);

function extractSteps(text: string): number | undefined {
  const digitMatch = text.match(/\b(\d+)\s*steps?\b|(?:within|in)\s+(\d+)\s+steps?/);
  if (digitMatch) {
    return parseInt(digitMatch[1] || digitMatch[2], 10);
  }
  const wordMap: Record<string, number> = {
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
  };
  const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+steps?\b/);
  if (wordMatch && wordMap[wordMatch[1]]) {
    return wordMap[wordMatch[1]];
  }
  return undefined;
}

function extractDirection(text: string): DetectionDirection | undefined {
  if (/\b(left|on my left|to my left|on the left)\b/.test(text)) {
    return 'left';
  }
  if (/\b(right|on my right|to my right|on the right)\b/.test(text)) {
    return 'right';
  }
  if (/\b(ahead|in front|front|center|centre|straight ahead)\b/.test(text)) {
    return 'center';
  }
  return undefined;
}

function extractObjectName(text: string): string | undefined {
  const patterns = [
    /(?:see|find|detect)\s+(?:a|an|any)?\s*([\w\s]+?)\s*(?:nearby|ahead|left|right|$)/,
    /(?:is there)\s+(?:a|an|any)?\s*([\w\s]+?)\s*(?:nearby|ahead|left|right|\?|$)/,
    /(?:any)\s+([\w\s]+?)\s+(?:nearby|ahead|around)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const raw = match[1].trim().split(/\s+/)[0];
      if (raw && raw.length > 1) {
        return OBJECT_ALIASES[raw] ?? raw;
      }
    }
  }
  if (/\bperson\b|\bpeople\b|\bsomeone\b/.test(text)) {
    return 'person';
  }
  if (/\bobstacle\b|\bhazard\b/.test(text)) {
    return 'obstacle';
  }
  return undefined;
}

function yesNoQuestion(text: string): boolean {
  return /^(is there|are there|do you see|can you see|is a|are any|is |are )\b/.test(text);
}

/**
 * blind_v1 announcement controls:
 * - "start" / "start announcements" / "resume announcements"
 * - "stop" / "stop announcements" / "pause announcements"
 */
function parseAnnouncementCommand(text: string): 'start' | 'stop' | null {
  const words = text.split(' ').filter(Boolean);
  if (words.length === 0) {
    return null;
  }

  if (words.length === 1 && words[0] === 'start') {
    return 'start';
  }
  if (words.length === 1 && (words[0] === 'stop' || words[0] === 'pause')) {
    return 'stop';
  }
  if (words.every(w => START_WORDS.has(w)) && (words.includes('start') || words.includes('resume'))) {
    return 'start';
  }
  if (words.every(w => STOP_WORDS.has(w)) && (words.includes('stop') || words.includes('pause'))) {
    return 'stop';
  }
  if (/^(start|resume)(\s+announcements)?$/.test(text)) {
    return 'start';
  }
  if (/^(stop|pause)(\s+announcements)?$/.test(text)) {
    return 'stop';
  }
  if (/^(enable|turn on)\s+(announcements|automatic announcements)$/.test(text)) {
    return 'start';
  }
  if (/^(disable|turn off)\s+(announcements|automatic announcements)$/.test(text)) {
    return 'stop';
  }
  return null;
}

function parseAction(text: string): {
  type: AssistantIntentType;
  action?: string;
  confidence: number;
  direction?: DetectionDirection;
  maxSteps?: number;
  objectName?: string;
  yesNoQuestion?: string;
  navigationTarget?: ParsedIntent['navigationTarget'];
} | null {
  const announcement = parseAnnouncementCommand(text);
  if (announcement === 'start') {
    return { type: 'ANNOUNCEMENTS', action: 'start_announcements', confidence: 0.98 };
  }
  if (announcement === 'stop') {
    return { type: 'ANNOUNCEMENTS', action: 'stop_announcements', confidence: 0.98 };
  }

  if (/(start|wake|enable)\s+(drishti|assistant)/.test(text)) {
    return { type: 'APP_CONTROL', action: 'start_assistant', confidence: 0.95 };
  }
  if (/(stop|sleep|disable)\s+(drishti|assistant)/.test(text)) {
    return { type: 'APP_CONTROL', action: 'stop_assistant', confidence: 0.95 };
  }
  if (/(go\s+)?home|take me home/.test(text)) {
    return {
      type: 'APP_CONTROL',
      action: 'go_home',
      confidence: 0.9,
      navigationTarget: 'home',
    };
  }
  if (/open\s+settings/.test(text)) {
    return {
      type: 'APP_CONTROL',
      action: 'open_settings',
      confidence: 0.88,
      navigationTarget: 'settings',
    };
  }
  if (/^help$|what can you do|commands/.test(text)) {
    return { type: 'HELP', action: 'help', confidence: 0.95 };
  }

  if (/start\s+camera|turn on camera|open camera/.test(text)) {
    return { type: 'CAMERA', action: 'start_camera', confidence: 0.92 };
  }
  if (/stop\s+camera|turn off camera|close camera/.test(text)) {
    return { type: 'CAMERA', action: 'stop_camera', confidence: 0.92 };
  }

  const direction = extractDirection(text);
  const maxSteps = extractSteps(text);
  const objectName = extractObjectName(text);

  if (/(what can you see|what do you see|describe (the )?scene|what's around|what is around)/.test(text)) {
    return { type: 'QUERY_SCENE', action: 'scene_summary', confidence: 0.9 };
  }
  if (/(what'?s in front|what is ahead|what is in front)/.test(text)) {
    return {
      type: 'QUERY_DIRECTION',
      action: 'direction_query',
      confidence: 0.88,
      direction: 'center',
    };
  }
  if (direction && /what|anything|something/.test(text)) {
    return {
      type: 'QUERY_DIRECTION',
      action: 'direction_query',
      confidence: 0.85,
      direction,
    };
  }
  if (maxSteps !== undefined) {
    return {
      type: 'QUERY_DISTANCE',
      action: 'within_steps',
      confidence: 0.86,
      maxSteps,
      objectName,
      direction,
    };
  }
  if (/person nearby|someone nearby|anyone nearby/.test(text)) {
    return {
      type: 'QUERY_YES_NO',
      action: 'person_nearby',
      confidence: 0.9,
      objectName: 'person',
      yesNoQuestion: text,
    };
  }
  if (/obstacle|something ahead|blocked ahead/.test(text)) {
    return {
      type: 'QUERY_YES_NO',
      action: 'obstacle_ahead',
      confidence: 0.85,
      objectName: 'obstacle',
      yesNoQuestion: text,
    };
  }
  if (yesNoQuestion(text)) {
    return {
      type: 'QUERY_YES_NO',
      action: objectName ? 'object_yes_no' : 'person_nearby',
      confidence: 0.75,
      objectName: objectName ?? 'person',
      direction,
      yesNoQuestion: text,
    };
  }

  return null;
}

export function parseIntent(rawText: string): ParsedIntent {
  const text = NORMALIZE(rawText);
  if (!text) {
    return {
      type: 'UNKNOWN',
      rawText,
      confidence: 0,
    };
  }

  const parsed = parseAction(text);
  if (!parsed) {
    return {
      type: 'UNKNOWN',
      rawText,
      confidence: 0.2,
    };
  }

  return {
    type: parsed.type,
    action: parsed.action,
    rawText,
    confidence: parsed.confidence,
    objectName: parsed.objectName,
    direction: parsed.direction,
    maxSteps: parsed.maxSteps,
    yesNoQuestion: parsed.yesNoQuestion,
    navigationTarget: parsed.navigationTarget,
  };
}

export const IntentParser = { parseIntent };
