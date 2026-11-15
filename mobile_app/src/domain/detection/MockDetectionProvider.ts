import type { Detection } from '../../core/types/detection.types';
import type { DetectionProvider } from './DetectionProvider';

const demoDetections: Detection[] = [
  {
    id: 'demo-person',
    className: 'person',
    category: 'people',
    confidence: 0.91,
    boundingBox: { x: 0.36, y: 0.18, width: 0.24, height: 0.62 },
    direction: 'center',
    estimatedSteps: 4,
    estimatedDistanceMeters: 3,
    timestamp: Date.now(),
  },
  {
    id: 'demo-chair',
    className: 'chair',
    category: 'furniture',
    confidence: 0.84,
    boundingBox: { x: 0.08, y: 0.48, width: 0.2, height: 0.34 },
    direction: 'left',
    estimatedSteps: 3,
    estimatedDistanceMeters: 2,
    timestamp: Date.now(),
  },
];

export class MockDetectionProvider implements DetectionProvider {
  private active = false;
  private readonly listeners = new Set<(detections: Detection[]) => void>();

  async start(): Promise<void> {
    this.active = true;
    this.publish();
  }

  async stop(): Promise<void> {
    this.active = false;
    this.listeners.forEach(listener => listener([]));
  }

  async getCurrentDetections(): Promise<Detection[]> {
    return this.active ? demoDetections.map(item => ({ ...item })) : [];
  }

  subscribeToDetections(listener: (detections: Detection[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(): void {
    const detections = demoDetections.map(item => ({ ...item }));
    this.listeners.forEach(listener => listener(detections));
  }
}

export const detectionProvider = new MockDetectionProvider();
