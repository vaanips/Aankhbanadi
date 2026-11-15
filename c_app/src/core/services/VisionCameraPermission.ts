import { PermissionService } from './PermissionService';
import { createLogger } from '../utils/logger';

const log = createLogger('VisionCameraPermission');

type VisionCamModule = {
  Camera?: {
    getCameraPermissionStatus?: () => string;
    requestCameraPermission?: () => Promise<string>;
  };
};

function getVisionCamera(): VisionCamModule['Camera'] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vision = require('react-native-vision-camera') as VisionCamModule;
    return vision.Camera ?? null;
  } catch {
    return null;
  }
}

function isGranted(status: string | null | undefined): boolean {
  return status === 'granted' || status === 'limited';
}

/**
 * Prefer vision-camera's own permission APIs (required to avoid
 * "permission-denied" CameraRuntimeError), then fall back to RN Permissions.
 */
export async function ensureCameraPermission(): Promise<boolean> {
  const Cam = getVisionCamera();

  if (Cam?.getCameraPermissionStatus) {
    try {
      const current = Cam.getCameraPermissionStatus();
      if (isGranted(current)) {
        return true;
      }
      if (Cam.requestCameraPermission) {
        const next = await Cam.requestCameraPermission();
        if (isGranted(next)) {
          return true;
        }
        log.warn('vision-camera permission result', next);
        return false;
      }
    } catch (error) {
      log.warn('vision-camera permission API failed, falling back', error);
    }
  }

  let status = await PermissionService.check('camera');
  if (!isGranted(status)) {
    status = await PermissionService.request('camera');
  }
  return isGranted(status);
}
