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
import { HapticService } from '../../../core/services/HapticService';
import { PermissionService } from '../../../core/services/PermissionService';
import { TextToSpeechService } from '../../../core/services/TextToSpeechService';
import { ensureCameraPermission } from '../../../core/services/VisionCameraPermission';
import { useAuthStore } from '../../../core/state/authStore';
import {
  UDID_FRAME_INTERVAL_MS,
  UDID_HOLD_STILL_MS,
} from '../../../core/utils/constants';
import {
  authenticateUdidPhotos,
  checkCardGuidance,
  CardGuidanceResult,
} from '../services/UdidAuthService';

type AuthPhase =
  | 'boot'
  | 'guiding'
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
let useCameraDevice: (position: 'back' | 'front') => unknown = () => null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const vision = require('react-native-vision-camera');
  CameraView = vision.Camera;
  useCameraDevice = vision.useCameraDevice;
} catch {
  CameraView = null;
  useCameraDevice = () => null;
}

const AuthCamera = React.forwardRef<
  CameraRef,
  { active: boolean; allowed: boolean; onPermissionLost?: () => void }
>(function AuthCamera({ active, allowed, onPermissionLost }, ref) {
  const device = useCameraDevice('back');

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
      }}
    />
  );
});

function speakAndWait(
  text: string,
  priority: 'high' | 'critical' = 'high',
): Promise<void> {
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
  const phaseRef = useRef<AuthPhase>('boot');

  const [phase, setPhase] = useState<AuthPhase>('boot');
  const [statusText, setStatusText] = useState('Preparing authentication…');
  const [detailText, setDetailText] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  // Card Guidance state
  const [cardInFrame, setCardInFrame] = useState(false);
  const [cardAligned, setCardAligned] = useState(false);

  const lastInstructionRef = useRef<string>('');
  const lastAnnounceTimeRef = useRef<number>(0);
  const consecutiveAlignedRef = useRef<number>(0);
  const guidanceRunningRef = useRef<boolean>(false);
  const isCapturingRef = useRef<boolean>(false);
  const startGuidanceLoopRef = useRef<(() => Promise<void>) | null>(null);

  const updatePhase = useCallback((next: AuthPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /**
   * Speak guidance message with intelligent rate-limiting:
   * Announces immediately if instruction changes, or every 4.5s if repeated.
   */
  const announceGuidance = useCallback((instruction: string, force = false) => {
    const now = Date.now();
    const isNew = instruction !== lastInstructionRef.current;
    const timeSinceLast = now - lastAnnounceTimeRef.current;

    if (force || isNew || timeSinceLast > 4500) {
      lastInstructionRef.current = instruction;
      lastAnnounceTimeRef.current = now;
      void TextToSpeechService.speak(instruction, 'high');
    }
  }, []);

  /**
   * Run the 2-second hold capture and upload to server for verification.
   */
  const executeScanCapture = useCallback(async () => {
    if (cancelled.current || isCapturingRef.current) {
      return;
    }
    isCapturingRef.current = true;
    updatePhase('holding');
    setStatusText('Hold still…');
    setDetailText('Scanning the readable ID details. Please keep steady for 2 seconds.');
    HapticService.trigger('heavy');

    await speakAndWait('Scanning your ID now. Please hold still for two seconds.', 'critical');
    if (cancelled.current) {
      isCapturingRef.current = false;
      return;
    }

    const cam = cameraRef.current;
    if (!cam?.takePhoto) {
      updatePhase('failed');
      setStatusText('Camera not ready');
      setDetailText('Double tap the screen to try again.');
      isCapturingRef.current = false;
      await speakAndWait('Camera is not ready. Double tap to try again.');
      return;
    }

    const holdPaths: string[] = [];
    const holdStart = Date.now();
    let nextShotAt = holdStart;

    try {
      while (Date.now() - holdStart < UDID_HOLD_STILL_MS) {
        if (cancelled.current) {
          isCapturingRef.current = false;
          return;
        }
        const now = Date.now();
        const pct = Math.min(1, (now - holdStart) / UDID_HOLD_STILL_MS);
        setHoldProgress(pct);

        if (now >= nextShotAt) {
          HapticService.light();
          const photo = await cam.takePhoto({
            flash: 'off',
            enableShutterSound: false,
          });
          if (photo?.path) {
            holdPaths.push(photo.path);
          }
          nextShotAt = Date.now() + UDID_FRAME_INTERVAL_MS;
        } else {
          await delay(35);
        }
      }
    } catch {
      updatePhase('failed');
      setStatusText('Capture error');
      setDetailText('Double tap to scan again.');
      isCapturingRef.current = false;
      await speakAndWait('Could not take photo. Double tap to try again.');
      return;
    }
    setHoldProgress(1);

    if (cancelled.current) {
      isCapturingRef.current = false;
      return;
    }

    if (holdPaths.length === 0) {
      updatePhase('failed');
      setStatusText('No frames captured');
      setDetailText('Double tap to try again.');
      isCapturingRef.current = false;
      await speakAndWait('No frames captured. Double tap to try again.');
      return;
    }

    updatePhase('verifying');
    setStatusText('Reading your disability ID…');
    setDetailText(`Analyzing ${holdPaths.length} frames with multi-angle OCR.`);
    await speakAndWait('Reading your disability ID card. Please wait.');

    if (cancelled.current) {
      isCapturingRef.current = false;
      return;
    }

    const result = await authenticateUdidPhotos(holdPaths);
    isCapturingRef.current = false;

    if (cancelled.current) {
      return;
    }

    // Success
    if (result.authenticated) {
      updatePhase('success');
      HapticService.trigger('heavy');
      const typeLabel = result.fields?.disability_type || 'visual impairment';
      setStatusText('Authentication Successful');
      setDetailText(
        [
          result.fields?.udid ? `UDID: ${result.fields.udid}` : null,
          `Category: ${typeLabel}`,
          result.fields?.disability_percentage
            ? `Percentage: ${result.fields.disability_percentage}%`
            : null,
          result.qrFound ? 'Verified with QR' : 'Verified with OCR',
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

    // Back of card detected - guide user to turn it over
    if (result.reason === 'card_back_detected') {
      updatePhase('guiding');
      setStatusText('Card Back Detected');
      setDetailText(
        'This is the back of your card. Turn the card over so the front with your disability details is facing the camera.',
      );
      HapticService.medium();
      await speakAndWait(
        'This is the back of your card. Please turn the card over so the front is facing the camera.',
        'critical',
      );
      // Restart guidance loop automatically
      void startGuidanceLoopRef.current?.();
      return;
    }

    // Authentication failed
    updatePhase('failed');
    setStatusText('Authentication Failed');
    setDetailText(
      `${result.message}\n\nDouble tap anywhere to scan again, or adjust the ID details in view.`,
    );
    await speakAndWait(
      `${result.message || 'Verification could not complete.'} Double tap anywhere to scan again.`,
      'high',
    );
  }, [onAuthenticated, setAuthenticated, updatePhase]);

  /**
   * Continuous Guidance Loop:
   * Checks whether the required ID details are readable and starts a scan
   * after two consecutive readable frames.
   */
  const startGuidanceLoop = useCallback(async () => {
    if (guidanceRunningRef.current || cancelled.current) {
      return;
    }
    guidanceRunningRef.current = true;
    updatePhase('guiding');
    setStatusText('Make ID Details Readable');
    setDetailText(
      'Keep the ID number and Disability Type text visible. The whole card does not need to fit.',
    );

    consecutiveAlignedRef.current = 0;
    lastInstructionRef.current = '';

    while (
      phaseRef.current === 'guiding' &&
      !cancelled.current &&
      !isCapturingRef.current
    ) {
      const cam = cameraRef.current;
      if (!cam?.takePhoto) {
        await delay(500);
        continue;
      }

      try {
        const previewPhoto = await cam.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });

        if (cancelled.current || phaseRef.current !== 'guiding') {
          break;
        }

        if (previewPhoto?.path) {
          const guidance: CardGuidanceResult | null = await checkCardGuidance(
            previewPhoto.path,
          );

          if (guidance && phaseRef.current === 'guiding') {
            setCardInFrame(guidance.cardDetected);
            setCardAligned(guidance.readyToScan);

            // Audio direction
            if (guidance.spokenInstruction) {
              announceGuidance(guidance.spokenInstruction);
            }

            // Haptic cues
            if (guidance.cardDetected && !cardInFrame) {
              HapticService.light();
            }

            // Auto-trigger when card is aligned and steady
            if (guidance.readyToScan) {
              consecutiveAlignedRef.current += 1;
              HapticService.medium();
              setStatusText('ID Details Readable');
              setDetailText('Hold steady… scanning automatically.');

              // Auto-capture after 2 consecutive aligned checks (~1.5s stability)
              if (consecutiveAlignedRef.current >= 2) {
                guidanceRunningRef.current = false;
                await executeScanCapture();
                return;
              }
            } else {
              consecutiveAlignedRef.current = 0;
              setStatusText(
                guidance.cardDetected
                  ? 'Reading ID Details'
                  : 'Looking for ID Text',
              );
              setDetailText(guidance.spokenInstruction);
            }
          }
        }
      } catch {
        // Continue loop if snapshot fails intermittently
      }

      await delay(900);
    }

    guidanceRunningRef.current = false;
  }, [announceGuidance, cardInFrame, executeScanCapture, updatePhase]);

  useEffect(() => {
    startGuidanceLoopRef.current = startGuidanceLoop;
  }, [startGuidanceLoop]);

  // Initial Boot
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
        setStatusText('Camera Permission Required');
        setDetailText(
          'Allow camera access in Settings, then double tap the screen to scan your UDID.',
        );
        await speakAndWait(
          'Camera permission is required to scan your disability ID. Allow camera access, then double tap the screen to try again.',
          'critical',
        );
        return;
      }

      setCameraReady(true);
      await delay(600);

      await speakAndWait(
        'Welcome to Drishti. Keep the ID number and Disability Type text visible. The whole card does not need to fit. I will tell you when the details are readable.',
        'high',
      );

      if (!cancelled.current) {
        void startGuidanceLoop();
      }
    };

    void boot();

    return () => {
      cancelled.current = true;
      guidanceRunningRef.current = false;
    };
  }, [startGuidanceLoop, updatePhase]);

  // Gestures: Single tap speaks status; double tap forces immediate scan
  const onSingleTap = useCallback(() => {
    HapticService.light();
    if (phaseRef.current === 'guiding') {
      const currentMsg =
        lastInstructionRef.current || 'Move the ID details into the camera view.';
      void TextToSpeechService.speak(currentMsg, 'high');
    } else if (phaseRef.current === 'holding') {
      void TextToSpeechService.speak('Holding still, capturing frames.', 'high');
    } else if (phaseRef.current === 'verifying') {
      void TextToSpeechService.speak('Reading your disability ID card. Please wait.', 'high');
    } else if (phaseRef.current === 'failed') {
      void TextToSpeechService.speak('Authentication failed. Double tap anywhere to scan again.', 'high');
    }
  }, []);

  const onDoubleTap = useCallback(() => {
    HapticService.medium();
    if (phaseRef.current === 'permission') {
      void (async () => {
        const granted = await ensureCameraPermission();
        if (!granted) {
          await PermissionService.openSettings();
          await speakAndWait(
            'Open settings, allow camera for Drishti, then return and double tap to scan again.',
          );
          return;
        }
        setCameraReady(true);
        startGuidanceLoop();
      })();
      return;
    }

    // Force scan immediately
    guidanceRunningRef.current = false;
    void executeScanCapture();
  }, [executeScanCapture, startGuidanceLoop]);

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd((_e, success) => {
      if (success) {
        runOnJS(onSingleTap)();
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(400)
    .onEnd((_e, success) => {
      if (success) {
        runOnJS(onDoubleTap)();
      }
    });

  const gesture = Gesture.Exclusive(doubleTapGesture, singleTapGesture);

  const busy =
    phase === 'holding' ||
    phase === 'capturing' ||
    phase === 'verifying' ||
    phase === 'boot';

  // Visual helper colors based on alignment
  const reticleColor = cardAligned
    ? '#10B981' // emerald green
    : cardInFrame
    ? '#F59E0B' // amber
    : 'rgba(245,245,240,0.4)';

  return (
    <GestureDetector gesture={gesture}>
      <SafeAreaView
        style={styles.root}
        edges={['top', 'bottom']}
        accessibilityLabel="Disability ID authentication. Tap once to hear ID text guidance. Double tap to scan."
      >
        <View style={styles.cameraWrap} accessibilityLabel="UDID scan camera view">
          <AuthCamera
            ref={cameraRef}
            allowed={cameraReady}
            active={cameraReady && phase !== 'permission' && phase !== 'boot'}
            onPermissionLost={() => {
              setCameraReady(false);
              updatePhase('permission');
              setStatusText('Camera Permission Required');
              setDetailText('Allow camera access, then double tap to try again.');
            }}
          />

          {/* Text guide for low-vision users and helpers; the whole card need not fit. */}
          {phase === 'guiding' ? (
            <View style={styles.reticleOverlay} pointerEvents="none">
              <View style={[styles.textGuideLine, { backgroundColor: reticleColor }]} />
              <Text style={[styles.reticleLabel, { color: reticleColor }]}>
                {cardAligned
                  ? 'TEXT READABLE - HOLD STILL'
                  : cardInFrame
                  ? 'KEEP ID TEXT VISIBLE'
                  : 'MOVE ID TEXT INTO VIEW'}
              </Text>
            </View>
          ) : null}

          {/* 2-second hold progress bar */}
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

        {/* Status and Spoken Guidance Panel */}
        <View style={styles.panel}>
          <Text style={styles.brand}>Drishti Access</Text>
          <Text style={styles.title} accessibilityRole="header">
            {statusText}
          </Text>
          {detailText ? (
            <Text
              style={styles.detail}
              accessibilityLiveRegion="polite"
            >
              {detailText}
            </Text>
          ) : null}

          {busy ? (
            <ActivityIndicator
              color="#F5F5F0"
              style={styles.spinner}
              accessibilityLabel="Processing"
            />
          ) : null}

          <View style={styles.hintsRow}>
            <Text style={styles.hintText}>
              • Tap once to repeat position
            </Text>
            <Text style={styles.hintText}>
              • Double tap to scan anytime
            </Text>
          </View>
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
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGuideLine: {
    width: '76%',
    height: 2,
    marginBottom: 12,
    opacity: 0.9,
  },
  reticleLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    textTransform: 'uppercase',
    backgroundColor: 'rgba(11,11,10,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  holdBarTrack: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 28,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(245,245,240,0.25)',
    overflow: 'hidden',
  },
  holdBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  panel: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245,245,240,0.18)',
    backgroundColor: '#0B0B0A',
    minHeight: 180,
  },
  brand: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
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
    color: '#D4D4CA',
    fontSize: 15,
    lineHeight: 22,
  },
  spinner: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  hintsRow: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245,245,240,0.12)',
  },
  hintText: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
  },
});
