import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useAuth } from "./useAuth";
import { getSupabase } from "@/lib/supabase";
export interface InboxItem {
  id: string;
  title: string;
  body: string;
  sessionId?: string;
  read: boolean;
  createdAt: string;
}
const Context = createContext<{
  items: InboxItem[];
  markRead: (id: string) => void;
  clear: () => void;
}>({ items: [], markRead: () => {}, clear: () => {} });
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  useEffect(() => {
    setItems([]);
    if (!user) return;
    let alive = true;
    const key = `scp.inbox.${user.id}`;
    void AsyncStorage.getItem(key).then((value) => {
      if (alive && value)
        try {
          setItems(JSON.parse(value));
        } catch {
          /* Ignore a corrupt local inbox; server-backed attendance is unaffected. */
        }
    });
    const add = (title: string, body: string, sessionId?: string, id = String(Date.now())) => {
      if (alive)
        setItems((prev) => {
          if (prev.some((n) => n.id === id)) return prev;
          const next = [
            { id, title, body, sessionId, read: false, createdAt: new Date().toISOString() },
            ...prev,
          ].slice(0, 100);
          void AsyncStorage.setItem(key, JSON.stringify(next));
          return next;
        });
    };
    const received = Notifications.addNotificationReceivedListener((n) => {
      const c = n.request.content;
      add(
        c.title ?? "Campus update",
        c.body ?? "",
        String(c.data?.sessionId ?? "") || undefined,
        n.request.identifier,
      );
    });
    const open = (r: Notifications.NotificationResponse) => {
      const id = r.notification.request.content.data?.sessionId;
      if (typeof id === "string" && user.role === "student")
        router.push({ pathname: "/student/attendance/[sessionId]", params: { sessionId: id } });
    };
    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (alive && r) open(r);
    });
    const sb = getSupabase();
    const channel = sb
      ?.channel(`native-inbox:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attendance_sessions" },
        (p) => {
          const row = p.new;
          if (user.role === "student" && user.courseIds.includes(String(row.course_id)))
            add("Attendance is open", String(row.topic), String(row.id), `session:${row.id}`);
        },
      )
      .subscribe();
    return () => {
      alive = false;
      received.remove();
      tapped.remove();
      if (channel) void sb?.removeChannel(channel);
    };
  }, [user]);
  const update = (next: InboxItem[]) => {
    setItems(next);
    if (user) void AsyncStorage.setItem(`scp.inbox.${user.id}`, JSON.stringify(next));
  };
  return (
    <Context.Provider
      value={{
        items,
        markRead: (id) => update(items.map((n) => (n.id === id ? { ...n, read: true } : n))),
        clear: () => update([]),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useNotifications = () => useContext(Context);
