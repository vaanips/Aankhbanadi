import type { Detection } from '../../core/types/detection.types';

export interface DetectionProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  getCurrentDetections(): Promise<Detection[]>;
  subscribeToDetections(listener: (detections: Detection[]) => void): () => void;
}
