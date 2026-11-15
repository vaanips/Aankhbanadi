import type { Detection, DetectionQuery } from '../../core/types/detection.types';

export function queryDetections(
  detections: Detection[],
  query: DetectionQuery,
): Detection[] {
  const requestedClass = query.className?.toLowerCase();
  return detections.filter(detection => {
    if (requestedClass && !detection.className.toLowerCase().includes(requestedClass)) {
      return false;
    }
    if (query.direction && detection.direction !== query.direction) {
      return false;
    }
    if (
      query.maximumSteps !== undefined &&
      detection.estimatedSteps !== undefined &&
      detection.estimatedSteps > query.maximumSteps
    ) {
      return false;
    }
    return true;
  });
}
