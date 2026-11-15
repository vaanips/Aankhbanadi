import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { runOnJS } from 'react-native-reanimated';
import { PermissionService } from '../../../core/services/PermissionService';
import { TextToSpeechService } from '../../../core/services/TextToSpeechService';
import { ensureCameraPermission } from '../../../core/services/VisionCameraPermission';
import { useAuthStore } from '../../../core/state/authStore';
import {
  UDID_FRAME_INTERVAL_MS,
  UDID_HOLD_STILL_MS,
} from '../../../core/utils/constants';
import { authenticateUdidPhotos } from '../services/UdidAuthService';

type AuthPhase =
  | 'boot'
  | 'prompt'
  | 'holding'
  | 'capturing'
  | 'verifying'
  | 'success'
  | 'failed'
  | 'permission';

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

const AuthCamera = React.forwardRef<
  CameraRef,
  { active: boolean; allowed: boolean; onPermissionLost?: () => void }
>(function AuthCamera({ active, allowed, onPermissionLost }, ref) {
  const device = useCameraDevice ? useCameraDevice('back') : null;

  if (!allowed || !CameraView || !device) {
    return (
      <View style={styles.cameraFallback}>
        <Text style={styles.fallbackTitle}>
          {allowed ? 'Camera unavailable' : 'Camera permission needed'}
        </Text>
        <Text style={styles.fallbackBody}>
          {allowed
            ? 'Enable camera access to scan your disability ID card.'
            : 'Allow camera access, then double tap the screen to scan your UDID.'}
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
          return;
        }
        // Non-permission camera errors stay silent to avoid redbox during auth.
      }}
    />
  );
});

function speakAndWait(text: string, priority: 'high' | 'critical' = 'high'): Promise<void> {
  return new Promise(resolve => {
    void TextToSpeechService.speak(text, priority, {
      onDone: () => resolve(),
      onError: () => resolve(),
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface UdidAuthScreenProps {
  onAuthenticated: () => void;
}

export function UdidAuthScreen({
  onAuthenticated,
}: UdidAuthScreenProps): React.JSX.Element {
  const setAuthenticated = useAuthStore(s => s.setAuthenticated);
  const cameraRef = useRef<CameraRef | null>(null);
  const flowStarted = useRef(false);
  const cancelled = useRef(false);
  const retrying = useRef(false);
  const phaseRef = useRef<AuthPhase>('boot');

  const [phase, setPhase] = useState<AuthPhase>('boot');
  const [statusText, setStatusText] = useState('Preparing authentication…');
  const [detailText, setDetailText] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const updatePhase = useCallback((next: AuthPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const runScanFlow = useCallback(async () => {
    if (cancelled.current) {
      return;
    }

    updatePhase('prompt');
    setStatusText('Scan your UDID');
    setDetailText('Hold your disability ID card in front of the camera.');
    setHoldProgress(0);

    await speakAndWait(
      'Please scan your UDID. Hold your disability identity card steady in front of the camera for two seconds.',
      'critical',
    );
    if (cancelled.current) {
      return;
    }

    await delay(800);
    if (cancelled.current) {
      return;
    }

    updatePhase('holding');
    setStatusText('Hold still…');
    setDetailText('Capturing frames for 2 seconds. Keep the full ID in view.');

    const cam = cameraRef.current;
    if (!cam?.takePhoto) {
      updatePhase('failed');
      setStatusText('Camera not ready');
      setDetailText('Double tap the screen to try again.');
      await speakAndWait(
        'Camera is not ready. Double tap the screen to try again.',
      );
      return;
    }

    // Capture ONLY during the 2-second hold window — no extra frames after.
    const holdPaths: string[] = [];
    const holdStart = Date.now();
    let nextShotAt = holdStart;
    try {
      while (Date.now() - holdStart < UDID_HOLD_STILL_MS) {
        if (cancelled.current) {
          return;
        }
        const now = Date.now();
        const pct = Math.min(1, (now - holdStart) / UDID_HOLD_STILL_MS);
        setHoldProgress(pct);

        if (now >= nextShotAt) {
          const photo = await cam.takePhoto({
            flash: 'off',
            enableShutterSound: false,
          });
          if (photo?.path) {
            holdPaths.push(photo.path);
          }
          nextShotAt = Date.now() + UDID_FRAME_INTERVAL_MS;
        } else {
          await delay(40);
        }
      }
    } catch {
      updatePhase('failed');
      setStatusText('Capture failed');
      setDetailText('Double tap the screen to scan again.');
      await speakAndWait(
        'I could not capture the ID photo. Double tap the screen to try again.',
      );
      return;
    }
    setHoldProgress(1);

    if (cancelled.current) {
      return;
    }

    if (holdPaths.length === 0) {
      updatePhase('failed');
      setStatusText('No frames captured');
      setDetailText('Double tap the screen to scan again.');
      await speakAndWait(
        'I could not capture frames during the 2 second hold. Double tap to try again.',
      );
      return;
    }

    updatePhase('verifying');
    setStatusText('Reading your ID…');
    setDetailText(
      `Checking ${holdPaths.length} hold frames with QR and OCR.`,
    );
    await speakAndWait('Reading your ID card. Please wait.');

    if (cancelled.current) {
      return;
    }

    const result = await authenticateUdidPhotos(holdPaths);

    if (cancelled.current) {
      return;
    }

    if (result.authenticated) {
      updatePhase('success');
      const typeLabel =
        result.fields?.disability_type || 'visual impairment';
      setStatusText('Authenticated');
      setDetailText(
        [
          result.fields?.udid ? `UDID: ${result.fields.udid}` : null,
          `Category: ${typeLabel}`,
          result.fields?.disability_percentage
            ? `Percentage: ${result.fields.disability_percentage}%`
            : null,
          result.qrFound ? 'QR code found' : 'Verified via OCR',
        ]
          .filter(Boolean)
          .join('\n'),
      );

      await setAuthenticated({
        authenticated: true,
        udid: result.fields?.udid ?? null,
        disabilityType: result.fields?.disability_type ?? null,
        disabilityPercentage: result.fields?.disability_percentage ?? null,
        authenticatedAt: Date.now(),
      });

      await speakAndWait(
        result.message ||
          'Authentication successful. Visual impairment verified. Opening Drishti assistance.',
        'critical',
      );

      if (!cancelled.current) {
        onAuthenticated();
      }
      return;
    }

    updatePhase('failed');
    setStatusText('Authentication failed');
    setDetailText(
      `${result.message}\n\nDouble tap the screen to scan again.`,
    );
    await speakAndWait(
      `${result.message || 'Authentication failed.'} Double tap the screen to scan again.`,
      'high',
    );
  }, [onAuthenticated, setAuthenticated, updatePhase]);

  useEffect(() => {
    cancelled.current = false;
    if (flowStarted.current) {
      return;
    }
    flowStarted.current = true;

    const boot = async () => {
      await TextToSpeechService.init();

      const granted = await ensureCameraPermission();
      if (!granted) {
        setCameraReady(false);
        updatePhase('permission');
        setStatusText('Camera permission required');
        setDetailText(
          'Allow camera access in Settings, then double tap the screen to scan your UDID.',
        );
        await speakAndWait(
          'Camera permission is required to scan your UDID. Allow camera access, then double tap the screen to try again.',
          'critical',
        );
        return;
      }

      setCameraReady(true);
      await delay(700);
      await runScanFlow();
    };

    void boot();

    return () => {
      cancelled.current = true;
    };
  }, [runScanFlow, updatePhase]);

  const onRetry = useCallback(() => {
    const current = phaseRef.current;
    if (current !== 'failed' && current !== 'permission') {
      return;
    }
    if (retrying.current) {
      return;
    }
    retrying.current = true;

    void (async () => {
      try {
        if (current === 'permission') {
          const granted = await ensureCameraPermission();
          if (!granted) {
            await PermissionService.openSettings();
            await speakAndWait(
              'Open settings, allow camera for Drishti, then return and double tap to scan again.',
            );
            return;
          }
          setCameraReady(true);
        }
        cancelled.current = false;
        await runScanFlow();
      } finally {
        retrying.current = false;
      }
    })();
  }, [runScanFlow]);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(400)
    .onEnd((_e, success) => {
      if (success) {
        runOnJS(onRetry)();
      }
    });

  const showRetryHint = phase === 'failed' || phase === 'permission';
  const busy =
    phase === 'holding' ||
    phase === 'capturing' ||
    phase === 'verifying' ||
    phase === 'boot' ||
    phase === 'prompt';

  return (
    <GestureDetector gesture={doubleTap}>
      <SafeAreaView
        style={styles.root}
        edges={['top', 'bottom']}
        accessibilityLabel="UDID authentication. Double tap to scan again when needed."
      >
        <View style={styles.cameraWrap} accessibilityLabel="UDID scan camera">
          <AuthCamera
            ref={cameraRef}
            allowed={cameraReady}
            active={cameraReady && phase !== 'permission' && phase !== 'boot'}
            onPermissionLost={() => {
              setCameraReady(false);
              updatePhase('permission');
              setStatusText('Camera permission required');
              setDetailText(
                'Allow camera access, then double tap the screen to try again.',
              );
            }}
          />
          {phase === 'holding' ? (
            <View style={styles.holdBarTrack} pointerEvents="none">
              <View
                style={[
                  styles.holdBarFill,
                  { width: `${Math.round(holdProgress * 100)}%` },
                ]}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.brand}>Drishti</Text>
          <Text style={styles.title} accessibilityRole="header">
            {statusText}
          </Text>
          {detailText ? <Text style={styles.detail}>{detailText}</Text> : null}

          {busy ? (
            <ActivityIndicator
              color="#F5F5F0"
              style={styles.spinner}
              accessibilityLabel="Working"
            />
          ) : null}

          {showRetryHint ? (
            <Text style={styles.hint} accessibilityLiveRegion="polite">
              Double tap anywhere to scan again
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0B0A',
  },
  cameraWrap: {
    flex: 1,
    backgroundColor: '#111110',
    overflow: 'hidden',
  },
  cameraFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#1A1A18',
  },
  fallbackTitle: {
    color: '#F5F5F0',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  fallbackBody: {
    color: '#B8B8B0',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  holdBarTrack: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(245,245,240,0.25)',
    overflow: 'hidden',
  },
  holdBarFill: {
    height: '100%',
    backgroundColor: '#E8E4D9',
  },
  panel: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245,245,240,0.18)',
    backgroundColor: '#0B0B0A',
    minHeight: 160,
  },
  brand: {
    color: '#A8A89E',
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    color: '#F5F5F0',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  detail: {
    color: '#C4C4BA',
    fontSize: 15,
    lineHeight: 22,
  },
  spinner: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  hint: {
    marginTop: 16,
    color: '#E8E4D9',
    fontSize: 16,
    fontWeight: '600',
  },
});
