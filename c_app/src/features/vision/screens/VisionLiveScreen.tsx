import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBlindAssist } from '../hooks/useBlindAssist';
import { PrimaryButton } from '../../../components/buttons/PrimaryButton';
import { DetectionOverlay } from '../components/DetectionOverlay';
import { getRemoteProvider } from '../../../domain/detection/detectionRuntime';
import { FRAME_UPLOAD_INTERVAL_MS } from '../../../core/utils/serverConfig';

type CameraRef = {
  takePhoto: (options?: {
    flash?: 'off' | 'on' | 'auto';
    enableShutterSound?: boolean;
  }) => Promise<{ path: string }>;
};

let CameraView: React.ComponentType<Record<string, unknown>> | null = null;
let useCameraDevice: ((position: 'back' | 'front') => unknown) | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const vision = require('react-native-vision-camera');
  CameraView = vision.Camera;
  useCameraDevice = vision.useCameraDevice;
} catch {
  CameraView = null;
  useCameraDevice = null;
}

const LiveCamera = React.forwardRef<
  CameraRef,
  { active: boolean; allowed: boolean; onPermissionLost?: () => void }
>(function LiveCamera({ active, allowed, onPermissionLost }, ref) {
  const device = useCameraDevice ? useCameraDevice('back') : null;

  if (!allowed || !CameraView || !device) {
    return (
      <View style={styles.cameraFallback} accessibilityLabel="Camera preview unavailable">
        <Text style={styles.fallbackTitle}>Camera</Text>
        <Text style={styles.fallbackBody}>
          {allowed
            ? 'Preview unavailable. Connect the laptop GPU server for detections when camera works.'
            : 'Camera permission is required. Allow access in settings, then reopen Drishti.'}
        </Text>
      </View>
    );
  }

  return (
    <CameraView
      ref={ref}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={active}
      photo={true}
      enableZoomGesture={false}
      onError={(error: { code?: string; message?: string }) => {
        const code = String(error?.code ?? '');
        const message = String(error?.message ?? '');
        if (
          code.includes('permission') ||
          message.toLowerCase().includes('permission')
        ) {
          onPermissionLost?.();
        }
      }}
    />
  );
});

export function VisionLiveScreen(): React.JSX.Element {
  const {
    cameraReady,
    permissionDenied,
    listening,
    statusText,
    serverStatus,
    heardText,
    detections,
    onMicPress,
    openSettings,
  } = useBlindAssist();

  const cameraRef = useRef<CameraRef | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [camPermissionLost, setCamPermissionLost] = useState(false);

  useEffect(() => {
    if (!cameraReady || permissionDenied) {
      return;
    }

    let cancelled = false;
    let busy = false;
    const provider = getRemoteProvider();

    const tick = async () => {
      if (cancelled || listening || busy) {
        return;
      }
      const cam = cameraRef.current;
      if (!cam?.takePhoto) {
        setFrameError('Camera capture not ready');
        return;
      }
      busy = true;
      try {
        const photo = await cam.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });
        if (!cancelled && photo?.path) {
          await provider.processFrameFile(photo.path);
          const err = provider.getLastError();
          setFrameError(err);
        }
      } catch (error) {
        setFrameError(error instanceof Error ? error.message : 'Frame capture failed');
      } finally {
        busy = false;
      }
    };

    const id = setInterval(() => {
      void tick();
    }, FRAME_UPLOAD_INTERVAL_MS);

    const warmup = setTimeout(() => {
      void tick();
    }, 800);

    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(warmup);
    };
  }, [cameraReady, permissionDenied, listening]);

  const triggerMic = useCallback(() => {
    void onMicPress();
  }, [onMicPress]);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(400)
    .onEnd((_e, success) => {
      if (success) {
        runOnJS(triggerMic)();
      }
    });

  return (
    <GestureDetector gesture={doubleTap}>
      <View
        style={styles.root}
        accessibilityLabel="Drishti live camera. Double tap anywhere to ask a question."
        accessibilityHint="Double tap the screen to start or stop the microphone."
      >
        {cameraReady ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <LiveCamera
              ref={cameraRef}
              allowed={cameraReady && !permissionDenied && !camPermissionLost}
              active={cameraReady && !permissionDenied && !camPermissionLost}
              onPermissionLost={() => {
                setCamPermissionLost(true);
                setFrameError('Camera permission denied');
              }}
            />
            <DetectionOverlay detections={detections} />
          </View>
        ) : (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.status}>{statusText}</Text>
          </View>
        )}

        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topBar} pointerEvents="none">
            <Text style={styles.statusChip} accessibilityLiveRegion="polite">
              {statusText}
            </Text>
            <Text style={styles.serverChip} accessibilityLiveRegion="polite">
              {serverStatus}
            </Text>
            {listening ? (
              <Text style={styles.listenChip} accessibilityLiveRegion="polite">
                Listening… speak now
              </Text>
            ) : (
              <Text style={styles.hintChip} accessibilityLiveRegion="polite">
                Double tap to ask
              </Text>
            )}
            {heardText ? (
              <Text style={styles.heardChip} accessibilityLiveRegion="polite">
                Heard: {heardText}
              </Text>
            ) : null}
            {frameError ? (
              <Text style={styles.errorChip} accessibilityLiveRegion="polite">
                {frameError}
              </Text>
            ) : null}
          </View>

          {permissionDenied ? (
            <View style={styles.permissionBox}>
              <Text style={styles.fallbackTitle}>Camera permission needed</Text>
              <PrimaryButton label="Open settings" onPress={() => void openSettings()} />
            </View>
          ) : null}
        </SafeAreaView>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101B2D',
  },
  status: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 18,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
    color: '#FFFFFF',
    backgroundColor: 'rgba(16, 27, 45, 0.65)',
    fontSize: 15,
    fontWeight: '600',
  },
  serverChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
    color: '#E2E8F0',
    backgroundColor: 'rgba(37, 99, 235, 0.55)',
    fontSize: 13,
    fontWeight: '600',
  },
  hintChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
    color: '#F8FAFC',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    fontSize: 13,
    fontWeight: '600',
  },
  listenChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
    color: '#FEF2F2',
    backgroundColor: 'rgba(220, 38, 38, 0.8)',
    fontSize: 13,
    fontWeight: '700',
  },
  heardChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
    color: '#ECFDF5',
    backgroundColor: 'rgba(22, 163, 74, 0.7)',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '90%',
    textAlign: 'center',
  },
  errorChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
    color: '#FEF2F2',
    backgroundColor: 'rgba(220, 38, 38, 0.75)',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: '90%',
    textAlign: 'center',
  },
  cameraFallback: {
    flex: 1,
    backgroundColor: '#101B2D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  fallbackBody: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
  },
  permissionBox: {
    marginHorizontal: 24,
    marginBottom: 28,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 27, 45, 0.85)',
    gap: 12,
  },
});
