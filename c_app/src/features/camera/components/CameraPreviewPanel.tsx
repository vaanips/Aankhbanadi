import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/typography/AppText';
import { useTheme } from '../../../theme/ThemeProvider';

interface CameraPreviewPanelProps {
  canShowLivePreview: boolean;
}

type LivePreviewProps = {
  active: boolean;
};

let LivePreviewInner: React.ComponentType<LivePreviewProps> | null = null;

try {
  // Optional native module — keep require guarded for environments without camera libs.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const vision = require('react-native-vision-camera') as {
    Camera: React.ComponentType<{
      style?: object;
      device: unknown;
      isActive: boolean;
      accessibilityLabel?: string;
    }>;
    useCameraDevice: (position: 'back' | 'front') => unknown;
  };

  LivePreviewInner = function VisionLivePreview({ active }: LivePreviewProps): React.JSX.Element | null {
    const device = vision.useCameraDevice('back');
    if (!device) {
      return null;
    }
    return (
      <vision.Camera
        style={styles.livePreview}
        device={device}
        isActive={active}
        accessibilityLabel="Live rear camera preview"
      />
    );
  };
} catch {
  LivePreviewInner = null;
}

export function CameraPreviewPanel({ canShowLivePreview }: CameraPreviewPanelProps): React.JSX.Element {
  const { theme } = useTheme();
  const showLive = Boolean(LivePreviewInner && canShowLivePreview);

  return (
    <View
      style={[styles.panel, { backgroundColor: theme.colors.navy, borderColor: theme.colors.border }]}
      accessibilityLabel={
        showLive
          ? 'Camera preview. Demo mode detections are simulated.'
          : 'Demo mode camera preview placeholder. No live video.'
      }
      accessibilityRole="image">
      <View style={[styles.demoTag, { backgroundColor: theme.colors.warning }]}>
        <AppText variant="label" style={{ color: theme.colors.navy }}>
          DEMO MODE
        </AppText>
      </View>
      {showLive && LivePreviewInner ? (
        <LivePreviewInner active={canShowLivePreview} />
      ) : (
        <View style={styles.fallback}>
          <AppText variant="title" style={{ color: theme.colors.white, textAlign: 'center' }}>
            Preview unavailable
          </AppText>
          <AppText
            variant="body"
            style={{ color: theme.colors.primaryMuted, textAlign: 'center', marginTop: 8 }}>
            Live camera preview is off or unavailable. Mock scene data still runs when assistance is
            active.
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
  demoTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
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
