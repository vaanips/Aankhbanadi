import { DETECTION_SERVER_URL } from '../../../core/utils/serverConfig';
import { createLogger } from '../../../core/utils/logger';

const log = createLogger('UdidAuthService');

export interface UdidAuthApiResult {
  authenticated: boolean;
  reason?: string;
  message: string;
  source?: string | null;
  qrFound?: boolean;
  fields?: {
    udid?: string | null;
    disability_type?: string | null;
    disability_percentage?: string | null;
    other?: Record<string, unknown>;
  };
  ocrLines?: string[];
  processingMs?: number;
  framesUsed?: number;
  bestSharpness?: number;
  orientation?: number;
}

export interface CardGuidanceResult {
  cardDetected: boolean;
  readyToScan: boolean;
  status:
    | 'aligned'
    | 'too_far'
    | 'too_close'
    | 'move_left'
    | 'move_right'
    | 'move_up'
    | 'move_down'
    | 'too_dark'
    | 'too_bright'
    | 'too_blurry'
    | 'no_card';
  spokenInstruction: string;
  box?: [number, number, number, number];
  orientationHint?: 'landscape' | 'portrait';
  metrics?: {
    coverage?: number;
    offsetX?: number;
    offsetY?: number;
    sharpness?: number;
    brightness?: number;
    qrFound?: boolean;
    readableTextLines?: number;
  };
}

function toFileUri(filePath: string): string {
  if (filePath.startsWith('file://') || filePath.startsWith('content://')) {
    return filePath;
  }
  return `file://${filePath}`;
}

/** Check whether the required ID details are readable for visually impaired users. */
export async function checkCardGuidance(
  filePath: string,
): Promise<CardGuidanceResult | null> {
  const form = new FormData();
  form.append('file', {
    uri: toFileUri(filePath),
    name: 'guidance_frame.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${DETECTION_SERVER_URL}/auth/guidance`, {
      method: 'POST',
      body: form,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as CardGuidanceResult;
  } catch (error) {
    log.warn('checkCardGuidance failed', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Upload only the frames captured during the 2s hold window. */
export async function authenticateUdidPhotos(
  filePaths: string[],
): Promise<UdidAuthApiResult> {
  if (filePaths.length === 0) {
    return {
      authenticated: false,
      reason: 'no_frames',
      message:
        'No frames were captured during the 2 second hold. Double tap and keep the ID details in view.',
    };
  }

  const form = new FormData();
  filePaths.forEach((filePath, index) => {
    form.append('files', {
      uri: toFileUri(filePath),
      name: `udid_${index}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch(`${DETECTION_SERVER_URL}/auth/udid`, {
      method: 'POST',
      body: form,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    log.warn('authenticateUdidPhotos failed', error);
    return {
      authenticated: false,
      reason: 'network',
      message:
        'I could not reach the laptop. Check that the laptop server is running, both devices use the same Wi-Fi, and the laptop address is correct.',
    };
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    log.warn(`UDID server returned ${res.status}`);
    return {
      authenticated: false,
      reason: 'server',
      message:
        'The laptop could not read the ID details. Check the server setup, keep the ID number and Disability Type text steady in good light, and try again. The whole card does not need to fit.',
    };
  }

  try {
    return (await res.json()) as UdidAuthApiResult;
  } catch (error) {
    log.warn('Invalid UDID server response', error);
    return {
      authenticated: false,
      reason: 'server_response',
      message:
        'The laptop returned an unreadable result. Please try scanning again.',
    };
  }
}

/** @deprecated prefer authenticateUdidPhotos */
export async function authenticateUdidPhoto(
  filePath: string,
): Promise<UdidAuthApiResult> {
  return authenticateUdidPhotos([filePath]);
}
