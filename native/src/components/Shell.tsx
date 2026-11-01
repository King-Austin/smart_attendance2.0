import { useEffect, useState, type ReactNode } from "react";
import {
  View,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import {
  LayoutDashboard,
  BookOpen,
  History,
  User,
  Plus,
  Bell,
  LogOut,
  ScanFace,
  ChevronLeft,
} from "lucide-react-native";
import NetInfo from "@react-native-community/netinfo";
import { useTheme } from "@/hooks/useTheme";
import { sessionLoadState, attendanceService, hydrateSessions } from "@/services/attendanceService";
import { useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { Button, Heading, Label, Notice } from "./ui";
import { NotificationCenter } from "./NotificationCenter";
const studentNav = [
  { name: "Dashboard", path: "/student/dashboard", icon: LayoutDashboard },
  { name: "History", path: "/student/history", icon: History },
  { name: "Check-in", path: "/student/dashboard", icon: Plus, hero: true },
  { name: "Courses", path: "/student/courses", icon: BookOpen },
  { name: "Profile", path: "/student/profile", icon: User },
];
const lecturerNav = [
  { name: "Dashboard", path: "/lecturer/dashboard", icon: LayoutDashboard },
  { name: "Sessions", path: "/lecturer/sessions", icon: History },
  { name: "Create", path: "/lecturer/create-session", icon: Plus, hero: true },
  { name: "Courses", path: "/lecturer/courses", icon: BookOpen },
  { name: "Profile", path: "/lecturer/profile", icon: User },
];
export function Shell({
  title,
  subtitle,
  children,
  publicPage = false,
  refreshing = false,
  onRefresh,
  scroll = true,
  back = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  publicPage?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  back?: boolean;
}) {
  const { user, signOut } = useAuth();
  const { variables, palette } = useTheme();
  const pathname = usePathname();
  const sessionError = useSyncExternalStore(
    attendanceService.subscribe,
    () => sessionLoadState.error,
  );
  const [online, setOnline] = useState(true);
  const [inbox, setInbox] = useState(false);
  const notifications = useNotifications();
  const unread = notifications.items.filter((item) => !item.read).length;
  const nav = user?.role === "student" ? studentNav : user?.role === "lecturer" ? lecturerNav : [];
  useEffect(
    () =>
      NetInfo.addEventListener((s) =>
        setOnline(s.isConnected !== false && s.isInternetReachable !== false),
      ),
    [],
  );
  const logout = () =>
    Alert.alert("Sign out?", "You can sign in again to access attendance.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void signOut()
            .then(() => router.replace("/login"))
            .catch((e) => Alert.alert("Could not sign out", e.message));
        },
      },
    ]);
  const content = (
    <View className="w-full max-w-3xl self-center gap-4 px-5 pb-8">
      <View className="mb-1 gap-1">
        <Heading>{title}</Heading>
        {subtitle && (
          <Label muted className="text-sm leading-5">
            {subtitle}
          </Label>
        )}
      </View>
      {children}
    </View>
  );
  return (
    <SafeAreaView
      style={variables}
      edges={["top", "left", "right", "bottom"]}
      className="flex-1 bg-background"
    >
      <View className="flex-row items-center justify-between px-5 pb-4 pt-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={back ? "Go back" : "Smart Campus home"}
          onPress={() =>
            back && router.canGoBack()
              ? router.back()
              : router.push(user ? `/${user.role}/dashboard` : "/")
          }
          className="flex-row items-center gap-2"
        >
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary">
            {back ? <ChevronLeft color="white" size={19} /> : <ScanFace color="white" size={19} />}
          </View>
          <Label className="text-sm font-bold">Smart Campus</Label>
        </Pressable>
        <View className="flex-row items-center gap-4">
          {user && !publicPage && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Notifications${unread ? `, ${unread} unread` : ""}`}
                accessibilityState={{ expanded: inbox }}
                className="h-12 w-12 items-center justify-center rounded-full bg-secondary/60 active:bg-secondary"
                onPress={() => setInbox(true)}
              >
                <Bell color={palette.foreground} size={20} />
                {unread > 0 ? (
                  <View className="absolute right-0 top-0 min-w-5 items-center rounded-full border-2 border-background bg-primary px-1">
                    <Label className="text-[10px] font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </Label>
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                onPress={logout}
                className="h-12 w-12 items-center justify-center rounded-full active:bg-secondary"
              >
                <LogOut color={palette["muted-foreground"]} size={19} />
              </Pressable>
            </>
          )}
        </View>
      </View>
      {!online && (
        <View className="mx-5 mb-3">
          <Notice text="You’re offline. Reconnect and refresh to verify attendance." />
        </View>
      )}
      {sessionError && !publicPage && (
        <View className="mx-5 mb-3 gap-2">
          <Notice danger text={sessionError} />
          <Button
            small
            variant="secondary"
            onPress={() => {
              void hydrateSessions().catch(() => {});
            }}
          >
            Retry session connection
          </Button>
        </View>
      )}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 8 }}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={palette.primary}
                />
              ) : undefined
            }
          >
            {content}
          </ScrollView>
        ) : (
          <View className="flex-1">{content}</View>
        )}
      </KeyboardAvoidingView>
      {!publicPage && nav.length > 0 && (
        <View className="mx-3 flex-row items-center justify-around rounded-3xl border border-border bg-card px-1 py-2">
          {nav.map((item) => {
            const selected = pathname === item.path && !item.hero;
            return (
              <Pressable
                key={item.name}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                accessibilityState={{ selected }}
                onPress={() => router.navigate(item.path as never)}
                className="min-h-12 min-w-14 items-center justify-center gap-1"
              >
                {item.hero ? (
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary">
                    <Plus size={24} color="white" />
                  </View>
                ) : (
                  <>
                    <item.icon
                      size={19}
                      color={selected ? palette.primary : palette["muted-foreground"]}
                    />
                    <Label
                      className={`text-[10px] font-semibold ${selected ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {item.name}
                    </Label>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
      <NotificationCenter visible={inbox} onClose={() => setInbox(false)} />
    </SafeAreaView>
  );
}
