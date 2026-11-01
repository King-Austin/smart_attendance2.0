import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SectionList, View } from "react-native";
import { router } from "expo-router";
import { Bell, BellRing, CheckCheck, ChevronRight, Inbox, Trash2 } from "lucide-react-native";
import { BottomSheet } from "./BottomSheet";
import { Label, Notice } from "./ui";
import { useNotifications } from "@/hooks/useNotifications";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { inboxSections, notificationTime } from "@/lib/inbox";

export function NotificationCenter({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { items, loading, storageError, markRead, markAllRead, clear } = useNotifications();
  const { palette } = useTheme();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!visible) return;
    setFilter("all");
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [visible]);
  const unread = items.filter((item) => !item.read).length;
  const sections = inboxSections(
    filter === "unread" ? items.filter((item) => !item.read) : items,
    new Date(now),
  );
  const clearInbox = () =>
    Alert.alert(
      "Clear your inbox?",
      "This removes all notifications from this device. Your attendance records stay saved.",
      [
        { text: "Keep notifications", style: "cancel" },
        { text: "Clear inbox", style: "destructive", onPress: clear },
      ],
    );
  return (
    <BottomSheet
      visible={visible}
      title="Your inbox"
      subtitle={
        loading
          ? "Loading your updates…"
          : unread
            ? `${unread} unread ${unread === 1 ? "update" : "updates"}`
            : "You’re all caught up"
      }
      onClose={onClose}
    >
      <View className="flex-row items-center justify-between gap-2 border-b border-border/30 px-5 pb-4">
        <View accessibilityRole="tablist" className="flex-row rounded-full bg-secondary p-1">
          {(["all", "unread"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === value }}
              onPress={() => setFilter(value)}
              className={`min-h-11 flex-row items-center gap-2 rounded-full px-4 ${filter === value ? "bg-card" : ""}`}
            >
              <Label
                className={`text-sm font-semibold ${filter === value ? "text-primary" : "text-muted-foreground"}`}
              >
                {value === "all" ? "All" : "Unread"}
              </Label>
              {value === "unread" && unread > 0 ? (
                <View className="rounded-full bg-primary/10 px-2 py-0.5">
                  <Label className="text-xs font-semibold text-primary">{unread}</Label>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
          disabled={loading || !unread}
          accessibilityState={{ disabled: loading || !unread }}
          onPress={markAllRead}
          className={`min-h-12 min-w-12 items-center justify-center rounded-full ${loading || !unread ? "opacity-30" : "active:bg-secondary"}`}
        >
          <CheckCheck size={22} color={palette.primary} />
        </Pressable>
      </View>
      {storageError ? (
        <View className="mx-5 mt-3">
          <Notice text="Some updates couldn’t be restored or saved on this device. New updates remain available while the app is open." />
        </View>
      ) : null}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={palette.primary} accessibilityLabel="Loading notifications" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 }}
          renderSectionHeader={({ section }) => (
            <View className="pb-2 pt-5">
              <Label muted className="text-xs font-semibold uppercase tracking-widest">
                {section.title}
              </Label>
            </View>
          )}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-3 px-5 py-10">
              <View className="mb-2 h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
                {filter === "unread" ? (
                  <CheckCheck size={32} color={palette.primary} />
                ) : (
                  <Inbox size={32} color={palette.primary} />
                )}
              </View>
              <Label className="text-lg font-bold">
                {filter === "unread" ? "All caught up" : "A little quiet here"}
              </Label>
              <Label muted className="text-center text-sm leading-6">
                {filter === "unread"
                  ? "You’ve read every update. New notifications will appear here."
                  : "Attendance alerts and campus updates will appear here when they arrive."}
              </Label>
              {filter === "unread" ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setFilter("all")}
                  className="min-h-12 justify-center px-5"
                >
                  <Label className="text-sm font-semibold text-primary">View all updates</Label>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const actionable = Boolean(item.sessionId && user?.role === "student");
            const Icon = item.sessionId ? BellRing : Bell;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.read ? "" : "Unread. "}${item.title}. ${item.body}. ${actionable ? "Open attendance" : item.read ? "Read notification" : "Mark as read"}`}
                onPress={() => {
                  markRead(item.id);
                  if (actionable && item.sessionId) {
                    onClose();
                    router.push({
                      pathname: "/student/attendance/[sessionId]",
                      params: { sessionId: item.sessionId },
                    });
                  }
                }}
                className={`flex-row items-start gap-3 rounded-3xl border p-4 active:opacity-70 ${item.read ? "border-border/30 bg-card" : "border-primary/15 bg-primary/5"}`}
              >
                <View
                  className={`h-10 w-10 items-center justify-center rounded-2xl ${item.read ? "bg-secondary" : "bg-primary/10"}`}
                >
                  <Icon
                    size={19}
                    color={item.read ? palette["muted-foreground"] : palette.primary}
                  />
                </View>
                <View className="flex-1 gap-1.5">
                  <View className="flex-row items-center gap-2">
                    <View className="flex-1">
                      <Label className="text-sm font-semibold leading-5">{item.title}</Label>
                    </View>
                    {!item.read ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
                  </View>
                  {item.body ? (
                    <Label muted className="text-sm leading-5">
                      {item.body}
                    </Label>
                  ) : null}
                  <View className="mt-1 flex-row flex-wrap items-center justify-between gap-2">
                    <Label muted className="text-xs">
                      {notificationTime(item.createdAt, now)}
                    </Label>
                    {actionable ? (
                      <View className="flex-row items-center gap-1">
                        <Label className="text-xs font-semibold text-primary">
                          Open attendance
                        </Label>
                        <ChevronRight size={13} color={palette.primary} />
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
      {items.length > 0 && !loading ? (
        <View className="border-t border-border/30 px-5 pt-2">
          <Pressable
            accessibilityRole="button"
            onPress={clearInbox}
            className="min-h-12 flex-row items-center justify-center gap-2 rounded-2xl active:bg-secondary"
          >
            <Trash2 size={16} color={palette["muted-foreground"]} />
            <Label muted className="text-sm font-medium">
              Clear inbox
            </Label>
          </Pressable>
        </View>
      ) : null}
    </BottomSheet>
  );
}
