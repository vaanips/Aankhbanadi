import type { Detection, GroupedDetection } from '../../core/types/detection.types';

export function groupDetections(detections: Detection[]): GroupedDetection[] {
  const groups = new Map<string, GroupedDetection>();
  for (const detection of detections) {
    const key = `${detection.className}:${detection.direction ?? 'unknown'}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.estimatedSteps =
        existing.estimatedSteps === undefined || detection.estimatedSteps === undefined
          ? undefined
          : Math.min(existing.estimatedSteps, detection.estimatedSteps);
    } else {
      groups.set(key, {
        className: detection.className,
        count: 1,
        direction: detection.direction,
        estimatedSteps: detection.estimatedSteps,
      });
    }
  }
  return Array.from(groups.values());
}
