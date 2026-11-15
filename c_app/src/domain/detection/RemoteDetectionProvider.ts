import { DETECTION_SERVER_URL } from '../../core/utils/serverConfig';
import { createLogger } from '../../core/utils/logger';
import { Detection } from '../../core/types/detection.types';
import {
  DetectionListener,
  DetectionProvider,
  Unsubscribe,
} from './DetectionProvider';

const log = createLogger('RemoteDetectionProvider');

function normalizeDetection(raw: Record<string, unknown>): Detection {
  const directionRaw = String(raw.direction ?? 'center');
  const direction =
    directionRaw === 'ahead' || directionRaw === 'center'
      ? 'center'
      : directionRaw === 'left'
        ? 'left'
        : directionRaw === 'right'
          ? 'right'
          : 'center';

  const box = (raw.boundingBox as Record<string, number> | undefined) ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };

  const distance =
    raw.estimatedDistanceMeters != null
      ? Number(raw.estimatedDistanceMeters)
      : raw.distance != null
        ? Number(raw.distance)
        : undefined;
  const confidence = Number(raw.confidence ?? 0);
  const group = String(raw.category ?? raw.group ?? 'Object');
  const label =
    raw.label != null
      ? String(raw.label)
      : distance != null
        ? `${group} ~${distance.toFixed(1)}m ${confidence.toFixed(2)}`
        : `${group} ${confidence.toFixed(2)}`;

  return {
    id: String(raw.id ?? `${Date.now()}`),
    className: String(raw.className ?? raw.name ?? 'object'),
    category: group,
    confidence,
    boundingBox: {
      x: Number(box.x ?? 0),
      y: Number(box.y ?? 0),
      width: Number(box.width ?? 0),
      height: Number(box.height ?? 0),
    },
    direction,
    estimatedDistanceMeters: distance,
    estimatedSteps:
      raw.estimatedSteps != null ? Number(raw.estimatedSteps) : undefined,
    timestamp: Number(raw.timestamp ?? Date.now()),
    trackingId: raw.trackingId != null ? String(raw.trackingId) : undefined,
    label,
    groupPhrase:
      raw.groupPhrase != null ? String(raw.groupPhrase) : undefined,
  };
}

export class RemoteDetectionProvider implements DetectionProvider {
  private listeners = new Set<DetectionListener>();
  private current: Detection[] = [];
  private running = false;
  private serverUrl: string;
  private lastError: string | null = null;
  private inflight = false;

  constructor(serverUrl: string = DETECTION_SERVER_URL) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
  }

  setServerUrl(url: string): void {
    this.serverUrl = url.replace(/\/$/, '');
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/health`, {method: 'GET'});
      if (!res.ok) {
        this.lastError = `Health ${res.status}`;
        return false;
      }
      const json = (await res.json()) as {ok?: boolean; backend?: string};
      this.lastError = null;
      log.info('Server health', json);
      return Boolean(json.ok);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Server unreachable';
      log.error('ping failed', error);
      return false;
    }
  }

  async start(): Promise<void> {
    this.running = true;
    const ok = await this.ping();
    if (!ok) {
      log.warn(`Detection server not reachable at ${this.serverUrl}`);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.current = [];
    this.emit();
  }

  isRunning(): boolean {
    return this.running;
  }

  getCurrentDetections(): Detection[] {
    return this.current;
  }

  subscribeToDetections(listener: DetectionListener): Unsubscribe {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  /**
   * Upload a local image file path (from VisionCamera takePhoto) to the laptop GPU server.
   */
  async processFrameFile(filePath: string): Promise<Detection[]> {
    if (!this.running || this.inflight) {
      return this.current;
    }
    this.inflight = true;
    try {
      const normalized = filePath.startsWith('file://')
        ? filePath
        : filePath.startsWith('content://')
          ? filePath
          : `file://${filePath}`;
      const form = new FormData();
      form.append('file', {
        uri: normalized,
        name: 'frame.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);

      const res = await fetch(`${this.serverUrl}/detect`, {
        method: 'POST',
        body: form,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const text = await res.text();
        this.lastError = `Detect ${res.status}: ${text.slice(0, 120)}`;
        // warn (not error) so LogBox does not cover the camera every frame
        log.warn(this.lastError);
        return this.current;
      }

      const json = (await res.json()) as {
        detections?: Record<string, unknown>[];
        inferenceMs?: number;
      };
      this.current = (json.detections ?? []).map(normalizeDetection);
      this.lastError = null;
      this.emit();
      return this.current;
    } catch (error) {
      this.lastError =
        error instanceof Error ? error.message : 'Upload failed';
      // Common when Wi‑Fi blips — do not spam red LogBox overlays.
      log.warn('processFrameFile failed', error);
      return this.current;
    } finally {
      this.inflight = false;
    }
  }

  private emit(): void {
    const snapshot = this.current;
    this.listeners.forEach(listener => listener(snapshot));
  }
}
