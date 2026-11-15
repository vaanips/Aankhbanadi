import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../../../components/layout/Screen';
import { Header } from '../../../components/layout/Header';
import { AppText } from '../../../components/typography/AppText';
import { PrimaryButton } from '../../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../../components/buttons/SecondaryButton';
import { announcementManager } from '../../../domain/announcements/AnnouncementManager';
import { PermissionService } from '../../../core/services/PermissionService';
import { useSettingsStore, ThemeModeSetting, VerbosityLevel } from '../../../core/state/settingsStore';
import { useVoiceStore } from '../../../core/state/voiceStore';
import { useActivityStore } from '../../../core/state/activityStore';
import { useTheme } from '../../../theme/ThemeProvider';
import type { ThemeMode } from '../../../theme/colors';

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={[styles.section, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <AppText variant="label" style={styles.sectionTitle}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function StepRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
  formatOption,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  formatOption?: (v: T) => string;
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={styles.stepRow} accessibilityLabel={label}>
      <AppText variant="body">{label}</AppText>
      <View style={styles.stepButtons}>
        {options.map(opt => {
          const selected = opt === value;
          const text = formatOption ? formatOption(opt) : String(opt);
          return (
            <Pressable
              key={String(opt)}
              onPress={() => onChange(opt)}
              style={[
                styles.stepChip,
                {
                  backgroundColor: selected ? theme.colors.primary : theme.colors.inputBackground,
                  minHeight: theme.minTouchTarget,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${text}`}
              accessibilityState={{ selected }}>
              <AppText variant="caption" style={{ color: selected ? theme.colors.white : theme.colors.text }}>
                {text}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
  hint,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  hint?: string;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.toggleRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={hint}>
      <AppText variant="body">{label}</AppText>
      <AppText variant="label" color="primary">
        {value ? 'On' : 'Off'}
      </AppText>
    </Pressable>
  );
}

const SPEECH_RATES = [0.35, 0.5, 0.65, 0.8];
const VOLUMES = [0.5, 0.75, 1.0];

export function SettingsScreen(): React.JSX.Element {
  const { setMode } = useTheme();
  const voiceEnabled = useSettingsStore(state => state.voiceEnabled);
  const speechRate = useSettingsStore(state => state.speechRate);
  const speechVolume = useSettingsStore(state => state.speechVolume);
  const highContrast = useSettingsStore(state => state.highContrast);
  const largeText = useSettingsStore(state => state.largeText);
  const hapticEnabled = useSettingsStore(state => state.hapticEnabled);
  const pushToTalk = useSettingsStore(state => state.pushToTalk);
  const verbosity = useSettingsStore(state => state.verbosity);
  const themeMode = useSettingsStore(state => state.themeMode);
  const update = useSettingsStore(state => state.update);
  const reset = useSettingsStore(state => state.reset);
  const announcementsEnabled = useVoiceStore(state => state.announcementsEnabled);
  const clearHistory = useActivityStore(state => state.clearHistory);

  const [cameraPermission, setCameraPermission] = useState<string>('unknown');
  const [micPermission, setMicPermission] = useState<string>('unknown');

  const refreshPermissions = useCallback(async () => {
    const camera = await PermissionService.check('camera');
    const mic = await PermissionService.check('microphone');
    setCameraPermission(camera);
    setMicPermission(mic);
  }, []);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  const announceChange = (message: string) => {
    announcementManager.announce(message, 'normal');
  };

  const setThemeSetting = (mode: ThemeModeSetting) => {
    update({ themeMode: mode });
    if (mode === 'light' || mode === 'dark') {
      setMode(mode as ThemeMode);
    }
    announceChange(`Theme set to ${mode}.`);
  };

  const toggleAnnouncements = () => {
    if (announcementsEnabled) {
      announcementManager.disable();
      useVoiceStore.getState().setAnnouncementsEnabled(false);
      announceChange('Auto announcements off.');
    } else {
      announcementManager.enable();
      useVoiceStore.getState().setAnnouncementsEnabled(true);
      announceChange('Auto announcements on.');
    }
  };

  const confirmClearHistory = () => {
    Alert.alert('Clear activity history?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void clearHistory();
          announceChange('History cleared.');
        },
      },
    ]);
  };

  const confirmReset = () => {
    Alert.alert('Reset all preferences?', 'This restores default voice and display settings.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          reset();
          announceChange('Preferences reset.');
        },
      },
    ]);
  };

  return (
    <Screen scroll accessibilityLabel="Settings">
      <Header title="Settings" subtitle="Accessibility and privacy" />
      <View style={styles.content}>
        <Section title="Voice">
          <ToggleRow
            label="Voice enabled"
            value={voiceEnabled}
            onToggle={() => {
              update({ voiceEnabled: !voiceEnabled });
              announceChange(voiceEnabled ? 'Voice off.' : 'Voice on.');
            }}
          />
          <StepRow
            label="Speech rate"
            options={SPEECH_RATES}
            value={speechRate}
            onChange={v => {
              update({ speechRate: v });
              announceChange('Speech rate updated.');
            }}
            formatOption={v => `${v}`}
          />
          <StepRow
            label="Volume"
            options={VOLUMES}
            value={speechVolume}
            onChange={v => {
              update({ speechVolume: v });
              announceChange('Volume updated.');
            }}
            formatOption={v => `${Math.round(v * 100)}%`}
          />
          <ToggleRow
            label="Auto announcements"
            value={announcementsEnabled}
            onToggle={toggleAnnouncements}
            hint="Controls spoken scene and UI announcements"
          />
          <StepRow<VerbosityLevel>
            label="Verbosity"
            options={['concise', 'detailed']}
            value={verbosity}
            onChange={v => {
              update({ verbosity: v });
              announceChange(`Verbosity ${v}.`);
            }}
            formatOption={v => (v === 'concise' ? 'Concise' : 'Detailed')}
          />
        </Section>

        <Section title="Visual">
          <StepRow<ThemeModeSetting>
            label="Theme"
            options={['light', 'dark', 'system']}
            value={themeMode}
            onChange={setThemeSetting}
            formatOption={v => v.charAt(0).toUpperCase() + v.slice(1)}
          />
          <ToggleRow
            label="High contrast"
            value={highContrast}
            onToggle={() => {
              update({ highContrast: !highContrast });
              announceChange(highContrast ? 'High contrast off.' : 'High contrast on.');
            }}
          />
          <ToggleRow
            label="Large text"
            value={largeText}
            onToggle={() => {
              update({ largeText: !largeText });
              announceChange(largeText ? 'Large text off.' : 'Large text on.');
            }}
          />
        </Section>

        <Section title="Interaction">
          <ToggleRow
            label="Haptic feedback"
            value={hapticEnabled}
            onToggle={() => update({ hapticEnabled: !hapticEnabled })}
          />
          <AppText variant="caption" color="secondary">
            Push-to-talk: {pushToTalk ? 'Press and hold the mic button to speak.' : 'Tap the mic to toggle listening.'}
          </AppText>
          <SecondaryButton
            label={pushToTalk ? 'Use tap-to-toggle mic' : 'Use push-to-talk mic'}
            onPress={() => {
              update({ pushToTalk: !pushToTalk });
              announceChange(pushToTalk ? 'Tap to toggle mic enabled.' : 'Push to talk enabled.');
            }}
          />
        </Section>

        <Section title="Privacy">
          <AppText variant="body">Camera: {cameraPermission}</AppText>
          <AppText variant="body">Microphone: {micPermission}</AppText>
          <SecondaryButton label="Refresh permissions" onPress={() => void refreshPermissions()} />
          <SecondaryButton label="Clear activity history" onPress={confirmClearHistory} />
          <PrimaryButton label="Reset preferences" onPress={confirmReset} />
          <AppText variant="caption" color="secondary" style={styles.privacyNote}>
            Drishti does not store raw audio or video by default. Voice processing uses on-device services in this
            build; activity log keeps text summaries only on your device.
          </AppText>
        </Section>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
    gap: 16,
    paddingBottom: 24,
  },
  section: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  stepRow: {
    gap: 8,
  },
  stepButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  privacyNote: {
    marginTop: 8,
  },
});