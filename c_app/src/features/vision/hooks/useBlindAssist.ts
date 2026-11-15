import { useCallback, useEffect, useRef, useState } from 'react';
import { appDetectionProvider, getRemoteProvider } from '../../../domain/detection/detectionRuntime';
import { AssistantController } from '../../../domain/assistant/AssistantController';
import { announcementManager } from '../../../domain/announcements/AnnouncementManager';
import { TextToSpeechService } from '../../../core/services/TextToSpeechService';
import { VoiceAssistantService } from '../../../core/services/VoiceAssistantService';
import { PermissionService } from '../../../core/services/PermissionService';
import { ensureCameraPermission } from '../../../core/services/VisionCameraPermission';
import { Detection } from '../../../core/types/detection.types';
import { useVoiceStore } from '../../../core/state/voiceStore';
import { useAppStore } from '../../../core/state/appStore';
import { DETECTION_SERVER_URL } from '../../../core/utils/serverConfig';

const ANNOUNCEMENT_INTERVAL_MS = 3000;
const DISTANCE_WARNING_METERS = 2.0;

function distanceToSteps(meters?: number): number | undefined {
  if (meters == null || !Number.isFinite(meters)) {
    return undefined;
  }
  return Math.max(1, Math.round(meters / 0.65));
}

function groupPhrase(detection: Detection): string {
  const extended = detection as Detection & { groupPhrase?: string };
  if (extended.groupPhrase) {
    return extended.groupPhrase;
  }
  const map: Record<string, string> = {
    Person: 'person',
    Vehicle: 'vehicle',
    Animal: 'animal',
    'Road signal': 'road signal',
    Furniture: 'furniture',
    Electronic: 'electronic',
    Electronics: 'electronic',
    'Kitchen item': 'kitchen item',
    'Sports equipment': 'sports equipment',
    Obstacle: 'obstacle',
    Object: 'object',
  };
  return map[detection.category] ?? 'object';
}

function groupSpeakKey(detection: Detection): string {
  return groupPhrase(detection);
}

function directionWord(direction?: string): string {
  if (!direction || direction === 'center') {
    return 'ahead';
  }
  return direction;
}

/** Same announcement structure as blind_v1 close-object / grouped scene alerts. */
function buildSceneAnnouncement(detections: Detection[]): string | null {
  const withDistance = detections
    .filter(d => d.estimatedDistanceMeters != null)
    .sort(
      (a, b) =>
        (a.estimatedDistanceMeters ?? 999) - (b.estimatedDistanceMeters ?? 999),
    );

  if (withDistance.length === 0) {
    return null;
  }

  const nearest = withDistance[0];
  const nearestDistance = nearest.estimatedDistanceMeters ?? 999;
  const nearestSteps = distanceToSteps(nearestDistance) ?? 1;
  const nearestDir = directionWord(nearest.direction);

  if (nearestDistance <= DISTANCE_WARNING_METERS) {
    const phrase = groupPhrase(nearest);
    return `Warning! There is a ${phrase} approximately ${nearestSteps} steps away, ${nearestDir}. Please be careful.`;
  }

  // Group by speakable group (Electronic / Person / …), not raw YOLO class (laptop)
  const grouped = new Map<
    string,
    { name: string; direction: string; steps: number; count: number }
  >();
  for (const item of withDistance) {
    const steps = distanceToSteps(item.estimatedDistanceMeters);
    if (steps == null) {
      continue;
    }
    const dir = directionWord(item.direction);
    const name = groupSpeakKey(item);
    const key = `${name}|${dir}|${steps}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, {
        name,
        direction: dir,
        steps,
        count: 1,
      });
    }
  }

  const parts = Array.from(grouped.values())
    .sort((a, b) => a.steps - b.steps || a.name.localeCompare(b.name))
    .slice(0, 4)
    .map(entry => {
      const noun =
        entry.name === 'person'
          ? entry.count === 1
            ? 'person'
            : 'people'
          : entry.count === 1
            ? entry.name
            : `${entry.name}s`;
      const stepWord = entry.steps === 1 ? 'step' : 'steps';
      return `${entry.count} ${noun} ${entry.direction}, approximately ${entry.steps} ${stepWord} away`;
    });

  return parts.length > 0 ? `I detect ${parts.join('; and ')}.` : null;
}

export function useBlindAssist() {
  const [cameraReady, setCameraReady] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [listening, setListening] = useState(false);
  const [statusText, setStatusText] = useState('Starting…');
  const [serverStatus, setServerStatus] = useState(`GPU server: ${DETECTION_SERVER_URL}`);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [heardText, setHeardText] = useState('');
  const detectionsRef = useRef<Detection[]>([]);
  const lastAnnounceAt = useRef(0);
  const lastMessage = useRef('');
  const startedRef = useRef(false);

  const controllerRef = useRef(
    new AssistantController(appDetectionProvider, {
      onAnnouncementsEnable: enabled => {
        if (enabled) {
          announcementManager.enable();
          announcementManager.resume();
        } else {
          announcementManager.disable();
        }
      },
      onAnnouncementsPause: paused => {
        if (paused) {
          announcementManager.pause();
        } else {
          announcementManager.resume();
        }
      },
    }),
  );

  useEffect(() => {
    // Real YOLO server → not demo mode for spoken responses.
    useAppStore.getState().setDemoMode(false);
  }, []);

  useEffect(() => {
    const unsubVoice = VoiceAssistantService.subscribe(state => {
      setListening(state === 'LISTENING');
      useVoiceStore.getState().setState(state);
      if (state === 'LISTENING') {
        setStatusText('Listening…');
      } else if (state === 'PROCESSING') {
        setStatusText('Processing…');
      } else if (state === 'IDLE') {
        setStatusText(prev => (prev === 'Starting…' ? prev : 'Ready'));
      }
    });

    VoiceAssistantService.setUtteranceHandler(async text => {
      setHeardText(text);
      setStatusText(`Heard: ${text}`);
      await controllerRef.current.processUtterance(text);
      announcementManager.resume();
      setStatusText('Ready');
    });

    return () => {
      unsubVoice();
    };
  }, []);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    let unsubscribeDetections: (() => void) | null = null;
    let announceTimer: ReturnType<typeof setInterval> | null = null;

    const boot = async () => {
      setStatusText('Requesting permissions…');
      await TextToSpeechService.init();

      const camOk = await ensureCameraPermission();
      let mic = await PermissionService.check('microphone');
      if (mic !== 'granted' && mic !== 'limited') {
        mic = await PermissionService.request('microphone');
      }

      if (!camOk) {
        setPermissionDenied(true);
        setStatusText('Camera permission required');
        await TextToSpeechService.speak(
          'Camera permission is required. Please allow camera access.',
          'high',
        );
        return;
      }

      setCameraReady(true);
      setStatusText('Connecting to laptop…');
      announcementManager.enable();

      unsubscribeDetections = appDetectionProvider.subscribeToDetections(next => {
        detectionsRef.current = next;
        setDetections(next);
        if (next.length > 0) {
          setServerStatus(`GPU · ${next.length} object${next.length === 1 ? '' : 's'}`);
        }
      });
      await appDetectionProvider.start();

      const remote = getRemoteProvider();
      const ok = await remote.ping();
      if (ok) {
        setServerStatus('GPU server connected');
        await TextToSpeechService.speak(
          'Drishti started. Connected to laptop detection.',
          'high',
        );
      } else {
        setServerStatus(`GPU offline · ${DETECTION_SERVER_URL}`);
        await TextToSpeechService.speak(
          'Drishti started. Laptop detection server is offline. Start the server on your computer.',
          'high',
        );
      }
      setStatusText('Ready');

      announceTimer = setInterval(() => {
        if (VoiceAssistantService.getState() === 'LISTENING') {
          return;
        }
        if (!announcementManager.isEnabled()) {
          return;
        }
        const now = Date.now();
        if (now - lastAnnounceAt.current < ANNOUNCEMENT_INTERVAL_MS) {
          return;
        }
        const message = buildSceneAnnouncement(detectionsRef.current);
        if (!message || message === lastMessage.current) {
          return;
        }
        lastAnnounceAt.current = now;
        lastMessage.current = message;
        announcementManager.announce(message, 'normal', message);
      }, 1000);
    };

    void boot();

    return () => {
      if (announceTimer) {
        clearInterval(announceTimer);
      }
      unsubscribeDetections?.();
      void appDetectionProvider.stop();
      VoiceAssistantService.reset();
    };
  }, []);

  const onMicPress = useCallback(async () => {
    // One tap starts a ~7s listen window (blind_v1 M-key). Tap again to finish early.
    setHeardText('');
    setStatusText(
      VoiceAssistantService.getState() === 'LISTENING' ? 'Processing…' : 'Listening…',
    );
    announcementManager.pause();
    await VoiceAssistantService.startPushToTalk();
    // Only resume auto-talk if announcements are still enabled (don't undo "stop").
    if (announcementManager.isEnabled()) {
      announcementManager.resume();
    }
    setStatusText('Ready');
  }, []);

  return {
    cameraReady,
    permissionDenied,
    listening,
    statusText,
    serverStatus,
    heardText,
    detections,
    onMicPress,
    openSettings: () => PermissionService.openSettings(),
  };
}
