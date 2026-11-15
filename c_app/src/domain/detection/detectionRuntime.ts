import { RemoteDetectionProvider } from './RemoteDetectionProvider';
import { DETECTION_SERVER_URL } from '../../core/utils/serverConfig';

/**
 * Phone talks to the laptop YOLO server (CUDA) over Wi‑Fi.
 * Swap this provider only if you change deployment architecture.
 */
export const appDetectionProvider = new RemoteDetectionProvider(DETECTION_SERVER_URL);

export function getRemoteProvider(): RemoteDetectionProvider {
  return appDetectionProvider;
}
