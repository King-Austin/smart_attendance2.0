import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useAuth } from "./useAuth";
import { getSupabase } from "@/lib/supabase";
import { mergeInbox, parseInbox, type InboxItem } from "@/lib/inbox";
export type { InboxItem } from "@/lib/inbox";

const Context = createContext<{
  items: InboxItem[];
  loading: boolean;
  storageError: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}>({
  items: [],
  loading: true,
  storageError: false,
  markRead: () => {},
  markAllRead: () => {},
  clear: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const role = user?.role;
  const courseKey = JSON.stringify(user?.courseIds ?? []);
  const courses = useRef(new Set<string>());
  useEffect(() => {
    courses.current = new Set<string>(JSON.parse(courseKey));
  }, [courseKey]);
  const [state, setState] = useState<{
    owner?: string;
    items: InboxItem[];
    loading: boolean;
    storageError: boolean;
  }>({ items: [], loading: true, storageError: false });
  const current = useRef(state);
  // Serialize writes so rapid read/clear/delivery actions cannot restore an older inbox.
  const writes = useRef(Promise.resolve());
  const change = useRef<(transform: (items: InboxItem[]) => InboxItem[]) => void>(() => {});

  useEffect(() => {
    let alive = true;
    const key = userId ? `scp.inbox.${userId}` : "";
    let loaded = false;
    let restored = false;
    current.current = { owner: userId, items: [], loading: Boolean(userId), storageError: false };
    setState(current.current);
    const publish = () => {
      if (alive) setState({ ...current.current });
    };
    const persist = () => {
      if (!loaded || !userId) return;
      const value = JSON.stringify(current.current.items);
      writes.current = writes.current
        .then(() => AsyncStorage.setItem(key, value))
        .catch(() => {
          if (alive) {
            current.current.storageError = true;
            publish();
          }
        });
    };
    const update = (transform: (items: InboxItem[]) => InboxItem[]) => {
      if (!alive) return;
      current.current = { ...current.current, items: transform(current.current.items) };
      publish();
      persist();
    };
    change.current = update;
    if (!userId)
      return () => {
        alive = false;
        change.current = () => {};
      };

    void writes.current
      .then(() => AsyncStorage.getItem(key))
      .then((value) => {
        if (!alive) return;
        current.current.items = mergeInbox(parseInbox(value), current.current.items);
        restored = true;
      })
      .catch(() => {
        if (alive) current.current.storageError = true;
      })
      .finally(() => {
        if (!alive) return;
        loaded = true;
        current.current.loading = false;
        publish();
        if (restored) persist();
      });
    const add = (
      title: string,
      body: string,
      sessionId?: string,
      id = String(Date.now()),
      read = false,
    ) => {
      update((previous) =>
        mergeInbox(previous, [
          {
            id: sessionId ? `session:${sessionId}` : id,
            title,
            body,
            sessionId,
            read,
            createdAt: new Date().toISOString(),
          },
        ]),
      );
    };
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      const sessionId =
        typeof content.data?.sessionId === "string" ? content.data.sessionId : undefined;
      add(
        content.title ?? "Campus update",
        content.body ?? "",
        sessionId,
        notification.request.identifier,
      );
    });
    const open = (response: Notifications.NotificationResponse) => {
      if (!alive) return;
      const { content, identifier } = response.notification.request;
      const sessionId =
        typeof content.data?.sessionId === "string" ? content.data.sessionId : undefined;
      add(content.title ?? "Campus update", content.body ?? "", sessionId, identifier, true);
      // Consume cold-start responses so returning to the app does not reopen an old session.
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
      if (sessionId && role === "student")
        router.push({ pathname: "/student/attendance/[sessionId]", params: { sessionId } });
    };
    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (alive && response) open(response);
      })
      .catch(() => {});
    const sb = getSupabase();
    const channel = sb
      ?.channel(`native-inbox:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attendance_sessions" },
        (payload) => {
          const row = payload.new;
          if (role === "student" && courses.current.has(String(row.course_id)))
            add("Attendance is open", String(row.topic), String(row.id));
        },
      )
      .subscribe();
    return () => {
      alive = false;
      change.current = () => {};
      received.remove();
      tapped.remove();
      if (channel) void sb?.removeChannel(channel);
    };
  }, [userId, role]);

  // Never render the previous account's notifications during an auth transition.
  const owned = state.owner === userId;
  return (
    <Context.Provider
      value={{
        items: owned ? state.items : [],
        loading: Boolean(userId) && (!owned || state.loading),
        storageError: owned && state.storageError,
        markRead: (id) => {
          if (current.current.owner === userId)
            change.current((items) =>
              items.map((item) => (item.id === id ? { ...item, read: true } : item)),
            );
        },
        markAllRead: () => {
          if (current.current.owner === userId)
            change.current((items) => items.map((item) => ({ ...item, read: true })));
        },
        clear: () => {
          if (current.current.owner === userId) change.current(() => []);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useNotifications = () => useContext(Context);
