import { Platform } from 'react-native';
import {
  check,
  request,
  openSettings,
  PERMISSIONS,
  RESULTS,
  Permission,
  PermissionStatus,
} from 'react-native-permissions';
import { createLogger } from '../utils/logger';

const log = createLogger('PermissionService');

export type DrishtiPermission = 'camera' | 'microphone';

function getPermission(permission: DrishtiPermission): Permission | null {
  if (Platform.OS === 'ios') {
    return permission === 'camera'
      ? PERMISSIONS.IOS.CAMERA
      : PERMISSIONS.IOS.MICROPHONE;
  }
  if (Platform.OS === 'android') {
    return permission === 'camera'
      ? PERMISSIONS.ANDROID.CAMERA
      : PERMISSIONS.ANDROID.RECORD_AUDIO;
  }
  return null;
}

export type NormalizedPermissionStatus =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable'
  | 'limited';

function normalize(status: PermissionStatus): NormalizedPermissionStatus {
  switch (status) {
    case RESULTS.GRANTED:
      return 'granted';
    case RESULTS.DENIED:
      return 'denied';
    case RESULTS.BLOCKED:
      return 'blocked';
    case RESULTS.LIMITED:
      return 'limited';
    case RESULTS.UNAVAILABLE:
    default:
      return 'unavailable';
  }
}

export const PermissionService = {
  async check(permission: DrishtiPermission): Promise<NormalizedPermissionStatus> {
    const native = getPermission(permission);
    if (!native) {
      return 'unavailable';
    }
    try {
      const status = await check(native);
      return normalize(status);
    } catch (error) {
      log.error(`check ${permission}`, error);
      return 'unavailable';
    }
  },

  async request(permission: DrishtiPermission): Promise<NormalizedPermissionStatus> {
    const native = getPermission(permission);
    if (!native) {
      return 'unavailable';
    }
    try {
      const status = await request(native);
      return normalize(status);
    } catch (error) {
      log.error(`request ${permission}`, error);
      return 'unavailable';
    }
  },

  async requestCameraAndMicrophone(): Promise<{
    camera: NormalizedPermissionStatus;
    microphone: NormalizedPermissionStatus;
  }> {
    const camera = await PermissionService.request('camera');
    const microphone = await PermissionService.request('microphone');
    return { camera, microphone };
  },

  openSettings(): Promise<void> {
    return openSettings().catch(error => {
      log.warn('openSettings failed', error);
    });
  },
};