import type { Detection, DetectionQuery } from '../../core/types/detection.types';
import { groupDetections } from '../detection/DetectionGroupingService';
import { queryDetections } from '../detection/DetectionQueryService';

const directionText: Record<string, string> = {
  left: 'on your left',
  center: 'ahead of you',
  right: 'on your right',
};

export function getQueryDetails(text: string): DetectionQuery {
  const normalized = text.toLowerCase();
  const direction = /\bleft\b/.test(normalized)
    ? 'left'
    : /\bright\b/.test(normalized)
      ? 'right'
      : /\b(ahead|front|in front)\b/.test(normalized)
        ? 'center'
        : undefined;
  const classMatch = normalized.match(
    /\b(person|people|chair|car|bicycle|door|table|stairs|obstacle)\b/,
  );
  const stepMatch = normalized.match(/\b(\d+)\s*steps?\b/);
  return {
    className: classMatch?.[1] === 'people' ? 'person' : classMatch?.[1],
    direction,
    maximumSteps: stepMatch ? Number(stepMatch[1]) : undefined,
    yesNo: /^(is|are|do|does|can)\b/.test(normalized.trim()),
  };
}

export function generateSceneResponse(
  utterance: string,
  detections: Detection[],
  demoMode: boolean,
): string {
  if (!demoMode) {
    return 'Camera assistance is not active. Start camera assistance to explore the clearly labelled demonstration scene.';
  }

  const query = getQueryDetails(utterance);
  const matches = queryDetections(detections, query);
  if (query.yesNo && query.className) {
    const name = query.className === 'person' ? 'a person' : `a ${query.className}`;
    if (!matches.length) return `I do not detect ${name} in the demonstration scene.`;
    const item = matches[0];
    const where = item.direction ? ` ${directionText[item.direction]}` : '';
    const distance = item.estimatedSteps ? ` approximately ${item.estimatedSteps} steps` : '';
    return `In the demonstration scene, yes, there is ${name}${distance}${where}.`;
  }

  const groups = groupDetections(matches);
  if (!groups.length) {
    return 'I do not detect matching objects in the demonstration scene. This is simulated data, not a live safety assessment.';
  }
  const summary = groups.map(group => {
    const label = group.count === 1 ? group.className : `${group.count} ${group.className}s`;
    const where = group.direction ? ` ${directionText[group.direction]}` : '';
    return `${label}${where}`;
  });
  return `In the demonstration scene, I detect ${summary.join(' and ')}. These are simulated detections, not a live safety assessment.`;
}
