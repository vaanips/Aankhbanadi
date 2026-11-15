import { MOCK_DETECTION_INTERVAL_MS } from '../../core/utils/constants';
import { createLogger } from '../../core/utils/logger';
import { Detection, DetectionDirection } from '../../core/types/detection.types';
import {
  DetectionProvider,
  DetectionListener,
  Unsubscribe,
} from './DetectionProvider';

const log = createLogger('MockDetectionProvider');

interface MockScenario {
  className: string;
  category: string;
  direction: DetectionDirection;
  steps: number;
  confidence: number;
}

const SCENARIOS: MockScenario[][] = [
  [
    {
      className: 'person',
      category: 'person',
      direction: 'center',
      steps: 5,
      confidence: 0.91,
    },
    {
      className: 'chair',
      category: 'furniture',
      direction: 'left',
      steps: 3,
      confidence: 0.82,
    },
  ],
  [
    {
      className: 'bottle',
      category: 'object',
      direction: 'right',
      steps: 2,
      confidence: 0.78,
    },
    {
      className: 'door',
      category: 'structure',
      direction: 'center',
      steps: 12,
      confidence: 0.88,
    },
  ],
  [
    {
      className: 'person',
      category: 'person',
      direction: 'left',
      steps: 4,
      confidence: 0.86,
    },
    {
      className: 'obstacle',
      category: 'hazard',
      direction: 'center',
      steps: 3,
      confidence: 0.84,
    },
    {
      className: 'cup',
      category: 'object',
      direction: 'right',
      steps: 2,
      confidence: 0.75,
    },
  ],
];

function buildDetection(scenario: MockScenario, index: number): Detection {
  const id = `mock-${Date.now()}-${index}`;
  return {
    id,
    className: scenario.className,
    category: scenario.category,
    confidence: scenario.confidence,
    boundingBox: {
      x: scenario.direction === 'left' ? 0.05 : scenario.direction === 'right' ? 0.65 : 0.35,
      y: 0.25,
      width: 0.22,
      height: 0.4,
    },
    direction: scenario.direction,
    estimatedDistanceMeters: scenario.steps * 0.75,
    estimatedSteps: scenario.steps,
    timestamp: Date.now(),
    trackingId: `track-${scenario.className}-${index}`,
  };
}

export class MockDetectionProvider implements DetectionProvider {
  private listeners = new Set<DetectionListener>();
  private detections: Detection[] = [];
  private running = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private scenarioIndex = 0;

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    log.info('Mock detection provider started (demo data only)');
    this.emitScenario();
    this.intervalId = setInterval(() => {
      this.scenarioIndex = (this.scenarioIndex + 1) % SCENARIOS.length;
      this.emitScenario();
    }, MOCK_DETECTION_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    this.detections = [];
    this.notify();
    log.info('Mock detection provider stopped');
  }

  getCurrentDetections(): Detection[] {
    return [...this.detections];
  }

  subscribeToDetections(listener: DetectionListener): Unsubscribe {
    this.listeners.add(listener);
    listener(this.getCurrentDetections());
    return () => this.listeners.delete(listener);
  }

  isRunning(): boolean {
    return this.running;
  }

  private emitScenario(): void {
    const scenario = SCENARIOS[this.scenarioIndex] ?? SCENARIOS[0];
    this.detections = scenario.map((item, index) => buildDetection(item, index));
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getCurrentDetections();
    this.listeners.forEach(listener => listener(snapshot));
  }
}