import 'react-native-reanimated';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, LogBox, StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { VisionLiveScreen } from './src/features/vision/screens/VisionLiveScreen';
import { UdidAuthScreen } from './src/features/auth/screens/UdidAuthScreen';
import { TextToSpeechService } from './src/core/services/TextToSpeechService';
import { useAuthStore } from './src/core/state/authStore';

LogBox.ignoreLogs([
  'Network request failed',
  'processFrameFile failed',
  'listen session failed',
  'Didn\'t understand',
  'Client side error',
  'Camera permission was denied',
  'permission-denied',
]);

function App(): React.JSX.Element {
  const hydrate = useAuthStore(s => s.hydrate);
  const [booting, setBooting] = useState(true);
  /** False until first-time UDID auth finishes (or returning user already authenticated). */
  const [enteredApp, setEnteredApp] = useState(false);

  useEffect(() => {
    void (async () => {
      await TextToSpeechService.init();
      await hydrate();
      if (useAuthStore.getState().authenticated) {
        setEnteredApp(true);
      }
      setBooting(false);
    })();
  }, [hydrate]);

  const onAuthenticated = useCallback(() => {
    setEnteredApp(true);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar hidden />
        {booting ? (
          <View style={styles.boot} accessibilityLabel="Loading Drishti">
            <ActivityIndicator color="#F5F5F0" size="large" />
          </View>
        ) : null}
        {!booting && !enteredApp ? (
          <UdidAuthScreen onAuthenticated={onAuthenticated} />
        ) : null}
        {!booting && enteredApp ? <VisionLiveScreen /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0B0A',
  },
});

export default App;
