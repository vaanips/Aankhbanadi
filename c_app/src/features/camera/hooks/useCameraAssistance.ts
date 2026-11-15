import { useCallback, useEffect, useRef, useState } from 'react';
import { appDetectionProvider } from '../../../domain/detection/detectionRuntime';
import { announcementManager } from '../../../domain/announcements/AnnouncementManager';
import { PermissionService } from '../../../core/services/PermissionService';
import { useCameraStore } from '../../../core/state/cameraStore';
import { useActivityStore } from '../../../core/state/activityStore';
import type { CameraPermissionStatus } from '../../../core/state/cameraStore';

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

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [canShowLivePreview, setCanShowLivePreview] = useState(false);

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
    setLastError(null);
    setCameraState('INITIALIZING');

    let status = await PermissionService.check('camera');
    if (status !== 'granted' && status !== 'limited') {
      status = await PermissionService.request('camera');
    }
    const mapped = mapPermission(status);
    setPermission(mapped);
    setCanShowLivePreview(mapped === 'granted');

    if (mapped !== 'granted') {
      setCameraState('ERROR');
      setLastError('Camera permission is required for assistance.');
      announcementManager.announce(
        'Camera permission is not granted. Open settings to allow camera access, or continue in demo mode without a live preview.',
        'high',
      );
      useActivityStore.getState().addEntry({
        kind: 'camera',
        title: 'Camera permission denied',
        detail: `Status: ${mapped}`,
      });
      return;
    }

    try {
      unsubscribeRef.current?.();
      unsubscribeRef.current = appDetectionProvider.subscribeToDetections(next => {
        setDetections(next);
      });
      await appDetectionProvider.start();
      setCameraState('ACTIVE');
      announcementManager.announce(
        'Camera assistance started. Demo mode is active — detections are simulated.',
        'high',
      );
      useActivityStore.getState().addEntry({
        kind: 'camera',
        title: 'Camera assistance started',
        detail: 'Demo mock detections active',
      });
    } catch {
      setCameraState('ERROR');
      setLastError('Failed to start camera assistance.');
      announcementManager.announce('Could not start camera assistance.', 'high');
    }
  }, [setCameraState, setDetections, setLastError, setPermission]);

  const stopAssistance = useCallback(async () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    await appDetectionProvider.stop();
    clearDetections();
    setCameraState('STOPPED');
    announcementManager.announce('Camera assistance stopped.', 'normal');
    useActivityStore.getState().addEntry({
      kind: 'camera',
      title: 'Camera assistance stopped',
    });
  }, [clearDetections, setCameraState]);

  const openAppSettings = useCallback(async () => {
    await PermissionService.openSettings();
    await refreshPermission();
  }, [refreshPermission]);

  return {
    cameraState,
    permission,
    detections,
    isActive: cameraState === 'ACTIVE' || appDetectionProvider.isRunning(),
    canShowLivePreview,
    startAssistance,
    stopAssistance,
    refreshPermission,
    openAppSettings,
  };
}