import {
  Detection,
  DetectionDirection,
  DetectionQueryFilters,
  DetectionQueryResult,
} from '../../core/types/detection.types';
import { DetectionGroupingService } from './DetectionGroupingService';

function matchesClass(detection: Detection, className?: string): boolean {
  if (!className) {
    return true;
  }
  const needle = className.toLowerCase();
  return (
    detection.className.toLowerCase().includes(needle) ||
    detection.category.toLowerCase().includes(needle)
  );
}

function matchesDirection(detection: Detection, direction?: DetectionDirection): boolean {
  if (!direction) {
    return true;
  }
  return (detection.direction ?? 'center') === direction;
}

function matchesSteps(detection: Detection, maxSteps?: number): boolean {
  if (maxSteps === undefined) {
    return true;
  }
  const steps = detection.estimatedSteps ?? Number.POSITIVE_INFINITY;
  return steps <= maxSteps;
}

function matchesConfidence(detection: Detection, minConfidence?: number): boolean {
  if (minConfidence === undefined) {
    return true;
  }
  return detection.confidence >= minConfidence;
}

export const DetectionQueryService = {
  filter(detections: Detection[], filters: DetectionQueryFilters = {}): Detection[] {
    return detections.filter(
      d =>
        matchesClass(d, filters.className) &&
        matchesDirection(d, filters.direction) &&
        matchesSteps(d, filters.maxSteps) &&
        matchesConfidence(d, filters.minConfidence),
    );
  },

  queryScene(detections: Detection[]): DetectionQueryResult {
    return {
      detections,
      matched: detections.length > 0,
      summary: DetectionGroupingService.summarize(detections),
    };
  },

  queryDirection(
    detections: Detection[],
    direction: DetectionDirection,
  ): DetectionQueryResult {
    const filtered = this.filter(detections, { direction });
    return {
      detections: filtered,
      matched: filtered.length > 0,
      summary: filtered.length
        ? DetectionGroupingService.summarize(filtered)
        : `nothing on the ${direction}`,
    };
  },

  queryWithinSteps(detections: Detection[], maxSteps: number): DetectionQueryResult {
    const filtered = this.filter(detections, { maxSteps });
    return {
      detections: filtered,
      matched: filtered.length > 0,
      summary: filtered.length
        ? DetectionGroupingService.summarize(filtered)
        : `nothing within ${maxSteps} steps`,
    };
  },

  queryNearbyPerson(detections: Detection[], maxSteps = 6): DetectionQueryResult {
    const filtered = this.filter(detections, {
      className: 'person',
      maxSteps,
    });
    return {
      detections: filtered,
      matched: filtered.length > 0,
      yesNoAnswer: filtered.length > 0,
      summary: filtered.length
        ? `${filtered.length === 1 ? 'a person' : 'people'} nearby`
        : 'no person nearby',
    };
  },

  queryObstacleAhead(detections: Detection[], maxSteps = 5): DetectionQueryResult {
    const hazards = ['obstacle', 'chair', 'door', 'bottle', 'car'];
    const filtered = detections.filter(d => {
      const name = d.className.toLowerCase();
      const isHazard = hazards.some(h => name.includes(h));
      return (
        isHazard &&
        matchesDirection(d, 'center') &&
        matchesSteps(d, maxSteps)
      );
    });
    return {
      detections: filtered,
      matched: filtered.length > 0,
      yesNoAnswer: filtered.length > 0,
      summary: filtered.length
        ? DetectionGroupingService.summarize(filtered)
        : 'no obstacle directly ahead',
    };
  },

  queryYesNo(
    detections: Detection[],
    filters: DetectionQueryFilters,
  ): DetectionQueryResult {
    const filtered = this.filter(detections, filters);
    return {
      detections: filtered,
      matched: filtered.length > 0,
      yesNoAnswer: filtered.length > 0,
    };
  },
};