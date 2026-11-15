import { Detection } from '../../core/types/detection.types';

export type DetectionListener = (detections: Detection[]) => void;
export type Unsubscribe = () => void;

export interface DetectionProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  getCurrentDetections(): Detection[];
  subscribeToDetections(listener: DetectionListener): Unsubscribe;
  isRunning(): boolean;
}