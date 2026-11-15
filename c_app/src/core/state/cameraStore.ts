import { create } from 'zustand';
import { Detection } from '../types/detection.types';
import { DEMO_MODE } from '../utils/constants';

export type CameraState =
  | 'CAMERA_IDLE'
  | 'INITIALIZING'
  | 'ACTIVE'
  | 'STOPPED'
  | 'ERROR';

export type CameraPermissionStatus =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable';

interface CameraStoreState {
  cameraState: CameraState;
  permission: CameraPermissionStatus;
  detections: Detection[];
  isDemoMode: boolean;
  lastError: string | null;
  setCameraState: (state: CameraState) => void;
  setPermission: (permission: CameraPermissionStatus) => void;
  setDetections: (detections: Detection[]) => void;
  upsertDetection: (detection: Detection) => void;
  clearDetections: () => void;
  setIsDemoMode: (demo: boolean) => void;
  setLastError: (error: string | null) => void;
}

export const useCameraStore = create<CameraStoreState>(set => ({
  cameraState: 'CAMERA_IDLE',
  permission: 'unknown',
  detections: [],
  isDemoMode: DEMO_MODE,
  lastError: null,
  setCameraState: cameraState => set({ cameraState }),
  setPermission: permission => set({ permission }),
  setDetections: detections => set({ detections }),
  upsertDetection: detection =>
    set(state => {
      const index = state.detections.findIndex(d => d.id === detection.id);
      if (index >= 0) {
        const next = [...state.detections];
        next[index] = detection;
        return { detections: next };
      }
      return { detections: [...state.detections, detection] };
    }),
  clearDetections: () => set({ detections: [] }),
  setIsDemoMode: isDemoMode => set({ isDemoMode }),
  setLastError: lastError => set({ lastError }),
}));