import { useCallback, useEffect, useRef, useState } from 'react';
import { appDetectionProvider } from '../../../domain/detection/detectionRuntime';
import { announcementManager } from '../../../domain/announcements/AnnouncementManager';
import { PermissionService } from '../../../core/services/PermissionService';
import { useCameraStore } from '../../../core/state/cameraStore';
import { useActivityStore } from '../../../core/state/activityStore';
import { useVoiceStore } from '../../../core/state/voiceStore';
import type { CameraPermissionStatus } from '../../../core/state/cameraStore';

const MIN_ANNOUNCEMENT_CONFIDENCE = 0.4;
const DETECTION_ANNOUNCEMENT_SCOPE = 'camera-detection';

function mapPermission(
  status: Awaited<ReturnType<typeof PermissionService.check>>,
): CameraPermissionStatus {
  if (status === 'granted' || status === 'limited') {
    return 'granted';
  }
  if (status === 'blocked') {
    return 'blocked';
  }
  if (status === 'denied') {
    return 'denied';
  }
  return 'unavailable';
}

export interface UseCameraAssistanceResult {
  cameraState: ReturnType<typeof useCameraStore.getState>['cameraState'];
  permission: CameraPermissionStatus;
  detections: ReturnType<typeof useCameraStore.getState>['detections'];
  isActive: boolean;
  canShowLivePreview: boolean;
  startAssistance: () => Promise<void>;
  stopAssistance: () => Promise<void>;
  refreshPermission: () => Promise<void>;
  openAppSettings: () => Promise<void>;
}

export function useCameraAssistance(): UseCameraAssistanceResult {
  const cameraState = useCameraStore(state => state.cameraState);
  const permission = useCameraStore(state => state.permission);
  const detections = useCameraStore(state => state.detections);
  const setCameraState = useCameraStore(state => state.setCameraState);
  const setPermission = useCameraStore(state => state.setPermission);
  const setDetections = useCameraStore(state => state.setDetections);
  const clearDetections = useCameraStore(state => state.clearDetections);
  const setLastError = useCameraStore(state => state.setLastError);
  const announcementsEnabled = useVoiceStore(state => state.announcementsEnabled);
  const voiceState = useVoiceStore(state => state.state);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const startAttemptRef = useRef(0);
  const lastDetectionAnnouncementRef = useRef('');
  const lastDetectionAnnouncementAtRef = useRef(0);
  const [canShowLivePreview, setCanShowLivePreview] = useState(false);

  useEffect(() => {
    if (announcementsEnabled && voiceState === 'IDLE') {
      lastDetectionAnnouncementRef.current = '';
      lastDetectionAnnouncementAtRef.current = 0;
    }
  }, [announcementsEnabled, voiceState]);

  const refreshPermission = useCallback(async () => {
    const status = await PermissionService.check('camera');
    const mapped = mapPermission(status);
    setPermission(mapped);
    setCanShowLivePreview(mapped === 'granted');
  }, [setPermission]);

  useEffect(() => {
    void refreshPermission();
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [refreshPermission]);

  const startAssistance = useCallback(async () => {
    if (cameraState === 'INITIALIZING' || cameraState === 'ACTIVE') {
      return;
    }

    const attempt = ++startAttemptRef.current;
    setLastError(null);
    setCameraState('INITIALIZING');
    try {
      let status = await PermissionService.check('camera');
      if (status !== 'granted' && status !== 'limited') {
        status = await PermissionService.request('camera');
      }
      if (attempt !== startAttemptRef.current) {
        return;
      }

      const mapped = mapPermission(status);
      setPermission(mapped);
      setCanShowLivePreview(mapped === 'granted');

      if (mapped !== 'granted') {
        setCameraState('ERROR');
        setLastError('Camera access is needed to start live object detection.');
        announcementManager.announce(
          'Camera access is needed for live object detection. Allow camera access in settings and try again.',
          'high',
        );
        useActivityStore.getState().addEntry({
          kind: 'camera',
          title: 'Camera permission denied',
          detail: `Status: ${mapped}`,
        });
        return;
      }

      unsubscribeRef.current?.();
      announcementManager.clearScope(DETECTION_ANNOUNCEMENT_SCOPE);
      lastDetectionAnnouncementRef.current = '';
      lastDetectionAnnouncementAtRef.current = 0;
      unsubscribeRef.current = appDetectionProvider.subscribeToDetections(
        next => {
          setDetections(next);
          const nearest = next
            .filter(
              detection =>
                detection.confidence >= MIN_ANNOUNCEMENT_CONFIDENCE &&
                detection.estimatedDistanceMeters != null &&
                Number.isFinite(detection.estimatedDistanceMeters),
            )
            .sort(
              (left, right) =>
                (left.estimatedDistanceMeters ?? Infinity) -
                (right.estimatedDistanceMeters ?? Infinity),
            )[0];

          if (!nearest) {
            lastDetectionAnnouncementRef.current = '';
            announcementManager.clearScope(DETECTION_ANNOUNCEMENT_SCOPE);
            return;
          }

          const distance = nearest.estimatedDistanceMeters ?? 0;
          const steps =
            nearest.estimatedSteps ?? Math.max(1, Math.round(distance / 0.65));
          const direction =
            !nearest.direction || nearest.direction === 'center'
              ? 'ahead'
              : nearest.direction;
          const name = nearest.className.replace(/_/g, ' ');
          const message = `There is a ${name}, approximately ${steps} ${
            steps === 1 ? 'step' : 'steps'
          } ${direction}.`;
          const key = `${name}:${steps}:${direction}`;
          const now = Date.now();
          if (key === lastDetectionAnnouncementRef.current) {
            return;
          }
          if (now - lastDetectionAnnouncementAtRef.current < 3_000) {
            lastDetectionAnnouncementRef.current = '';
            announcementManager.clearScope(DETECTION_ANNOUNCEMENT_SCOPE);
            return;
          }

          lastDetectionAnnouncementRef.current = key;
          lastDetectionAnnouncementAtRef.current = now;
          announcementManager.announceLatest(
            distance <= 2 ? `Warning. ${message} Please be careful.` : message,
            distance <= 2 ? 'high' : 'normal',
            `${DETECTION_ANNOUNCEMENT_SCOPE}:${key}`,
            DETECTION_ANNOUNCEMENT_SCOPE,
          );
        },
      );
      await appDetectionProvider.start();
      if (attempt !== startAttemptRef.current) {
        return;
      }

      setCameraState('ACTIVE');
      const unavailable = appDetectionProvider.getLastError() !== null;
      setLastError(
        unavailable
          ? 'Live detection is unavailable. Reconnect to the laptop to resume object detection.'
          : null,
      );
      announcementManager.announce(
        unavailable
          ? 'Camera assistance started, but live detection is unavailable. Reconnect to the laptop to detect objects.'
          : 'Live camera assistance started.',
        'high',
      );
      useActivityStore.getState().addEntry({
        kind: 'camera',
        title: 'Camera assistance started',
        detail: unavailable
          ? 'Detection server unavailable'
          : 'Live detection active',
      });
    } catch (error) {
      if (attempt !== startAttemptRef.current) {
        return;
      }
      setCameraState('ERROR');
      setLastError(
        'Could not start live camera assistance. Check camera access and try again.',
      );
      announcementManager.announce(
        'Could not start live camera assistance. Check camera access and try again.',
        'high',
      );
      useActivityStore.getState().addEntry({
        kind: 'camera',
        title: 'Camera assistance failed to start',
        detail:
          error instanceof Error ? error.message : 'Unknown startup error',
      });
    }
  }, [cameraState, setCameraState, setDetections, setLastError, setPermission]);

  const stopAssistance = useCallback(async () => {
    ++startAttemptRef.current;
    const wasActive =
      useCameraStore.getState().cameraState === 'ACTIVE' ||
      useCameraStore.getState().cameraState === 'INITIALIZING' ||
      appDetectionProvider.isRunning();
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    announcementManager.clearScope(DETECTION_ANNOUNCEMENT_SCOPE);
    await appDetectionProvider.stop();
    clearDetections();
    setLastError(null);
    setCameraState('STOPPED');
    if (wasActive) {
      announcementManager.announce('Camera assistance stopped.', 'normal');
      useActivityStore.getState().addEntry({
        kind: 'camera',
        title: 'Camera assistance stopped',
      });
    }
  }, [clearDetections, setCameraState, setLastError]);

  const openAppSettings = useCallback(async () => {
    await PermissionService.openSettings();
    await refreshPermission();
  }, [refreshPermission]);

  return {
    cameraState,
    permission,
    detections,
    isActive: cameraState === 'ACTIVE',
    canShowLivePreview,
    startAssistance,
    stopAssistance,
    refreshPermission,
    openAppSettings,
  };
}
