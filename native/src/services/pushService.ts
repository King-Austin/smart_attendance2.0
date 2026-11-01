import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { config } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
let registeredToken: string | null = null;
export async function enablePush(userId: string) {
  if (!Device.isDevice) throw new Error("Remote notifications require a physical device.");
  if (!config.easProjectId)
    throw new Error("Configure the EAS project ID and platform push credentials first.");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("attendance", {
      name: "Attendance sessions",
      importance: Notifications.AndroidImportance.HIGH,
    });
  let status = await Notifications.getPermissionsAsync();
  if (!status.granted && status.canAskAgain) status = await Notifications.requestPermissionsAsync();
  if (!status.granted) throw new Error("Allow notifications in app settings.");
  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: config.easProjectId,
  });
  const { error } = await getSupabase()!
    .from("native_push_tokens")
    .upsert(
      { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: "token" },
    );
  if (error)
    throw new Error(
      "Push registration failed. Apply the native push migration before enabling notifications.",
    );
  registeredToken = token;
  await SecureStore.setItemAsync("scp.push.registration", JSON.stringify({ userId, token }));
}
export async function disablePush(userId: string) {
  if (!registeredToken) {
    const stored = await SecureStore.getItemAsync("scp.push.registration");
    if (stored) {
      try {
        const value = JSON.parse(stored);
        if (value.userId === userId) registeredToken = value.token;
      } catch {
        /* A corrupt local token record is not trusted for revocation. */
      }
    }
  }
  if (registeredToken) {
    const { error } = await getSupabase()!
      .from("native_push_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("token", registeredToken);
    if (error) throw new Error("Could not unregister push. Retry sign out.");
    registeredToken = null;
    await SecureStore.deleteItemAsync("scp.push.registration");
  }
}
export async function notifySession(sessionId: string) {
  const { error } = await getSupabase()!.functions.invoke("native-session-push", {
    body: { sessionId },
  });
  if (error)
    throw new Error("Session started, but push delivery failed. Check the native push deployment.");
}
