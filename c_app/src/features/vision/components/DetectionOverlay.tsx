import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Detection } from '../../../core/types/detection.types';

interface DetectionOverlayProps {
  detections: Detection[];
}

/**
 * Visual style matched to blind_v1.py OpenCV drawing:
 * - green rectangle thickness ~2
 * - green label above box: "{group} ~{distance}m {confidence}"
 */
export function DetectionOverlay({ detections }: DetectionOverlayProps): React.JSX.Element {
  const { width: screenW, height: screenH } = useWindowDimensions();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {detections.map(detection => {
        const box = detection.boundingBox;
        const left = box.x * screenW;
        const top = box.y * screenH;
        const width = Math.max(box.width * screenW, 8);
        const height = Math.max(box.height * screenH, 8);

        const group = detection.category || detection.className;
        const distance = detection.estimatedDistanceMeters;
        const confidence = detection.confidence;
        const label =
          (detection as Detection & { label?: string }).label ??
          (distance != null
            ? `${group} ~${distance.toFixed(1)}m ${confidence.toFixed(2)}`
            : `${group} ${confidence.toFixed(2)}`);

        return (
          <View key={detection.id} style={StyleSheet.absoluteFill}>
            <View
              style={[
                styles.box,
                {
                  left,
                  top,
                  width,
                  height,
                },
              ]}
            />
            <Text
              style={[
                styles.label,
                {
                  left,
                  top: Math.max(4, top - 22),
                  maxWidth: Math.min(screenW - left - 8, 280),
                },
              ]}
              numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00FF00',
    backgroundColor: 'transparent',
  },
  label: {
    position: 'absolute',
    color: '#00FF00',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
