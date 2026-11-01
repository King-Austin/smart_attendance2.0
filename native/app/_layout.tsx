import "react-native-gesture-handler";
import "../global.css";
import { useEffect } from "react";
import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { NotificationProvider } from "@/hooks/useNotifications";
void SplashScreen.preventAutoHideAsync().catch(() => {});
function Navigator() {
  const { dark, variables } = useTheme();
  return (
    <View style={variables} className="flex-1 bg-background">
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
    </View>
  );
}
export default function Root() {
  const [loaded, error] = useFonts({
    Geist: Geist_400Regular,
    GeistMedium: Geist_500Medium,
    GeistSemiBold: Geist_600SemiBold,
    GeistBold: Geist_700Bold,
  });
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <Navigator />
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  return (
    <View
      style={{
        flex: 1,
        padding: 32,
        justifyContent: "center",
        gap: 16,
        backgroundColor: "#f6f8fc",
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Something went wrong</Text>
      <Text>The screen could not load. Your attendance has not been confirmed by this error.</Text>
      <Text accessibilityRole="button" onPress={retry} style={{ color: "#244dc2", padding: 12 }}>
        Retry screen
      </Text>
    </View>
  );
}
