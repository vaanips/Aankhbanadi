export type DetectionDirection = 'left' | 'center' | 'right';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  id: string;
  className: string;
  /** blind_v1 group label, e.g. Person / Furniture / Electronics */
  category: string;
  confidence: number;
  boundingBox: BoundingBox;
  direction?: DetectionDirection;
  estimatedDistanceMeters?: number;
  estimatedSteps?: number;
  timestamp: number;
  trackingId?: string;
  /** OpenCV-style label: "{group} ~1.2m 0.91" */
  label?: string;
  /** Spoken phrase from blind_v1 get_group_phrase */
  groupPhrase?: string;
}

export interface DetectionQueryFilters {
  className?: string;
  category?: string;
  direction?: DetectionDirection;
  maxSteps?: number;
  minConfidence?: number;
}

export interface DetectionQueryResult {
  detections: Detection[];
  matched: boolean;
  summary?: string;
  yesNoAnswer?: boolean;
}