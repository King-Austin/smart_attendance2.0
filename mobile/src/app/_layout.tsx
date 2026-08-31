import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { AuthProvider } from '@/providers/auth-provider';

void SplashScreen.preventAutoHideAsync();
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }));

  useEffect(() => {
    void SplashScreen.hideAsync();
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const data = event.notification.request.content.data;
      if (data?.type === 'session_opened' && typeof data?.sessionId === 'string') router.push(`/(student)/attendance/${data.sessionId}`);
    });
    return () => response.remove();
  }, []);

  const dark = colorScheme === 'dark';
  const baseTheme = dark ? DarkTheme : DefaultTheme;
  const appColors = dark ? Colors.dark : Colors.light;
  const navigationTheme = {
    ...baseTheme,
    colors: { ...baseTheme.colors, primary: appColors.primary, background: appColors.background, card: appColors.surface, text: appColors.text, border: appColors.border },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style={dark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
