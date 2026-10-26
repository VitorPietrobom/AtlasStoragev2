import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAtlas } from '../data/store';
import { useTheme } from '../theme';

export default function RootLayout() {
  const p = useTheme();
  const ready = useAtlas((s) => s.ready);
  const init = useAtlas((s) => s.init);
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });

  useEffect(() => {
    void init();
  }, [init]);

  if (!ready || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: p.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={p.inkMuted} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="units" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 0.9], sheetGrabberVisible: true }} />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="setup" options={{ gestureEnabled: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
