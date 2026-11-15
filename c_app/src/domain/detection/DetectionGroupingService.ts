import { Detection, DetectionDirection } from '../../core/types/detection.types';
import { capitalize, pluralize } from '../../core/utils/formatters';

export interface DetectionGroup {
  className: string;
  count: number;
  items: Detection[];
}

export interface DirectionGroup {
  direction: DetectionDirection;
  count: number;
  items: Detection[];
}

function numberWord(count: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return words[count] ?? String(count);
}

export const DetectionGroupingService = {
  groupByClass(detections: Detection[]): DetectionGroup[] {
    const map = new Map<string, Detection[]>();
    detections.forEach(d => {
      const key = d.className.toLowerCase();
      const list = map.get(key) ?? [];
      list.push(d);
      map.set(key, list);
    });
    return [...map.entries()].map(([className, items]) => ({
      className,
      count: items.length,
      items,
    }));
  },

  groupByDirection(detections: Detection[]): DirectionGroup[] {
    const map = new Map<DetectionDirection, Detection[]>();
    detections.forEach(d => {
      const direction = d.direction ?? 'center';
      const list = map.get(direction) ?? [];
      list.push(d);
      map.set(direction, list);
    });
    return [...map.entries()].map(([direction, items]) => ({
      direction,
      count: items.length,
      items,
    }));
  },

  summarize(detections: Detection[]): string {
    if (detections.length === 0) {
      return 'nothing detected';
    }
    const groups = this.groupByClass(detections).sort((a, b) => b.count - a.count);
    const parts = groups.map(g => {
      const label = g.count === 1 ? g.className : pluralize(g.className, g.count);
      return g.count === 1 ? `one ${label}` : `${numberWord(g.count)} ${label}`;
    });
    if (parts.length === 1) {
      return parts[0];
    }
    if (parts.length === 2) {
      return `${parts[0]} and ${parts[1]}`;
    }
    const last = parts.pop();
    return `${parts.join(', ')}, and ${last}`;
  },

  summarizeWithDirections(detections: Detection[]): string {
    const base = this.summarize(detections);
    const byDir = this.groupByDirection(detections);
    if (byDir.length <= 1) {
      return base;
    }
    const dirParts = byDir.map(g => `${g.count} on the ${g.direction}`);
    return `${base} (${dirParts.join(', ')})`;
  },

  displayName(className: string): string {
    return capitalize(className);
  },
};