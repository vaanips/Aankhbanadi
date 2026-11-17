import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/typography/AppText';
import { useTheme } from '../../../theme/ThemeProvider';
import { FRAME_UPLOAD_INTERVAL_MS } from '../../../core/utils/serverConfig';

interface CameraPreviewPanelProps {
  canShowLivePreview: boolean;
  active: boolean;
  onFrameCaptured: (path: string) => Promise<void>;
}

type LivePreviewProps = {
  active: boolean;
  onFrameCaptured: (path: string) => Promise<void>;
};

type CameraRef = {
  takePhoto: (options?: {
    flash?: 'off' | 'on' | 'auto';
    enableShutterSound?: boolean;
  }) => Promise<{ path: string }>;
};

type CameraProps = {
  ref?: React.Ref<CameraRef>;
  style?: object;
  device: unknown;
  isActive: boolean;
  photo: boolean;
  onInitialized?: () => void;
};

let LivePreviewInner: React.ComponentType<LivePreviewProps> | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const vision = require('react-native-vision-camera') as {
    Camera: React.ComponentType<CameraProps>;
    useCameraDevice: (position: 'back' | 'front') => unknown;
  };

  LivePreviewInner = function VisionLivePreview({
    active,
    onFrameCaptured,
  }: LivePreviewProps): React.JSX.Element | null {
    const device = vision.useCameraDevice('back');
    const cameraRef = useRef<CameraRef | null>(null);
    const initialized = useRef(false);

    useEffect(() => {
      if (!active) {
        return;
      }

      let cancelled = false;
      let busy = false;
      const captureAndSend = async () => {
        if (cancelled || busy || !initialized.current) {
          return;
        }
        const camera = cameraRef.current;
        if (!camera) {
          return;
        }
        busy = true;
        try {
          const photo = await camera.takePhoto({
            flash: 'off',
            enableShutterSound: false,
          });
          if (!cancelled && photo.path) {
            await onFrameCaptured(photo.path);
          }
        } catch {
          // A camera warm-up frame can fail; the next scheduled frame retries.
        } finally {
          busy = false;
        }
      };

      const warmup = setTimeout(() => {
        void captureAndSend();
      }, 500);
      const interval = setInterval(() => {
        void captureAndSend();
      }, FRAME_UPLOAD_INTERVAL_MS);

      return () => {
        cancelled = true;
        clearTimeout(warmup);
        clearInterval(interval);
      };
    }, [active, onFrameCaptured]);

    if (!device) {
      return null;
    }

    return (
      <vision.Camera
        ref={cameraRef}
        style={styles.livePreview}
        device={device}
        isActive={active}
        photo={true}
        onInitialized={() => {
          initialized.current = true;
        }}
      />
    );
  };
} catch {
  LivePreviewInner = null;
}

export function CameraPreviewPanel({
  canShowLivePreview,
  active,
  onFrameCaptured,
}: CameraPreviewPanelProps): React.JSX.Element {
  const { theme } = useTheme();
  const showLive = Boolean(LivePreviewInner && canShowLivePreview);

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.colors.navy,
          borderColor: theme.colors.border,
        },
      ]}
      accessibilityLabel={
        showLive
          ? active
            ? 'Live camera preview. Object detection is running.'
            : 'Live rear camera preview. Object detection is stopped.'
          : 'Camera preview placeholder. No live video.'
      }
      accessibilityRole="image"
    >
      {showLive && LivePreviewInner ? (
        <LivePreviewInner
          active={active && canShowLivePreview}
          onFrameCaptured={onFrameCaptured}
        />
      ) : (
        <View style={styles.fallback}>
          <AppText
            variant="title"
            style={{ color: theme.colors.white, textAlign: 'center' }}
          >
            Camera preview unavailable
          </AppText>
          <AppText
            variant="body"
            style={{
              color: theme.colors.primaryMuted,
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            Allow camera access to use live object detection.
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    minHeight: 220,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 16,
  },
  livePreview: {
    flex: 1,
    minHeight: 220,
  },
  fallback: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});
