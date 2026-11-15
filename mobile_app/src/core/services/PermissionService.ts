import { Platform } from 'react-native';
import {
  PERMISSIONS,
  RESULTS,
  check,
  openSettings,
  request,
} from 'react-native-permissions';

export type PermissionResult = 'granted' | 'denied' | 'blocked';

function nativePermission(kind: 'camera' | 'microphone') {
  if (Platform.OS === 'ios') {
    return kind === 'camera' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.IOS.MICROPHONE;
  }
  return kind === 'camera'
    ? PERMISSIONS.ANDROID.CAMERA
    : PERMISSIONS.ANDROID.RECORD_AUDIO;
}

function mapStatus(status: string): PermissionResult {
  if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) return 'granted';
  if (status === RESULTS.BLOCKED) return 'blocked';
  return 'denied';
}

export const permissionService = {
  async request(kind: 'camera' | 'microphone'): Promise<PermissionResult> {
    const permission = nativePermission(kind);
    const current = await check(permission);
    if (current === RESULTS.GRANTED || current === RESULTS.LIMITED) {
      return 'granted';
    }
    return mapStatus(await request(permission));
  },

  async openAppSettings(): Promise<void> {
    await openSettings();
  },
};
