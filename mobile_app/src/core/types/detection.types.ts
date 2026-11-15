export type DetectionDirection = 'left' | 'center' | 'right';

export interface Detection {
  id: string;
  className: string;
  category: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  direction?: DetectionDirection;
  estimatedDistanceMeters?: number;
  estimatedSteps?: number;
  timestamp: number;
  trackingId?: string;
}

export interface DetectionQuery {
  className?: string;
  direction?: DetectionDirection;
  maximumSteps?: number;
  yesNo?: boolean;
}

export interface GroupedDetection {
  className: string;
  count: number;
  direction?: DetectionDirection;
  estimatedSteps?: number;
}
