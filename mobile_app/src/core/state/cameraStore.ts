import { create } from 'zustand';
import type { Detection } from '../types/detection.types';

export type CameraStatus =
  | 'CAMERA_IDLE'
  | 'CAMERA_INITIALIZING'
  | 'CAMERA_ACTIVE'
  | 'CAMERA_STOPPED'
  | 'CAMERA_ERROR';

interface CameraState {
  status: CameraStatus;
  detections: Detection[];
  setStatus: (status: CameraStatus) => void;
  setDetections: (detections: Detection[]) => void;
}

export const useCameraStore = create<CameraState>(set => ({
  status: 'CAMERA_IDLE',
  detections: [],
  setStatus: status => set({ status }),
  setDetections: detections => set({ detections }),
}));
