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
}

function toFileUri(filePath: string): string {
  if (filePath.startsWith('file://') || filePath.startsWith('content://')) {
    return filePath;
  }
  return `file://${filePath}`;
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
        'No frames were captured during the 2 second hold. Double tap and keep the ID in view.',
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

  try {
    const res = await fetch(`${DETECTION_SERVER_URL}/auth/udid`, {
      method: 'POST',
      body: form,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Auth server ${res.status}: ${text.slice(0, 160)}`);
    }
    return (await res.json()) as UdidAuthApiResult;
  } catch (error) {
    log.warn('authenticateUdidPhotos failed', error);
    return {
      authenticated: false,
      reason: 'network',
      message:
        'I could not reach the authentication server. Make sure the laptop server is running on the same Wi‑Fi.',
    };
  }
}

/** @deprecated prefer authenticateUdidPhotos */
export async function authenticateUdidPhoto(
  filePath: string,
): Promise<UdidAuthApiResult> {
  return authenticateUdidPhotos([filePath]);
}
