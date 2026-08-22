import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  Trash2,
  Radio,
  AlertTriangle,
  FileSpreadsheet,
  Info,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { notificationService } from "@/services/notificationService";
import type { AppNotification, NotificationType } from "@/types/notification";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "session_started":
      return <Radio className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    case "attendance_warning":
      return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    case "session_summary":
      return <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    default:
      return <Info className="h-4 w-4 text-primary" />;
  }
}

function getNotificationBadgeTone(type: NotificationType) {
  switch (type) {
    case "session_started":
      return "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300";
    case "attendance_warning":
      return "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300";
    case "session_summary":
      return "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300";
    default:
      return "bg-primary/10 border-primary/30 text-primary";
  }
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function NotificationCenter() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const userId = user?.id ?? "current";

  useEffect(() => {
    // Subscribe to real-time notification changes
    const unsubscribe = notificationService.subscribe(() => {
      setNotifications(notificationService.getNotificationsForUser(userId));
    });

    // Initialize native push listeners on mount
    void notificationService.initNativePush();

    return () => {
      unsubscribe();
    };
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredList = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const handleMarkAllRead = () => {
    notificationService.markAllAsRead(userId);
  };

  const handleClearAll = () => {
    notificationService.clearAll(userId);
  };

  const handleItemClick = (notification: AppNotification) => {
    notificationService.markAsRead(notification.id);
    if (notification.link) {
      setOpen(false);
      void router.navigate({ to: notification.link as any });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card/90 text-foreground shadow-2xs transition-all hover:bg-muted active:scale-90"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        {/* Header */}
        <SheetHeader className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base font-bold tracking-tight text-foreground">
                Notifications
              </SheetTitle>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {unreadCount} new
                </span>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllRead}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title="Mark all as read"
                  >
                    <CheckCheck className="mr-1 h-3.5 w-3.5" />
                    Read all
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 px-2 text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                  title="Clear all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Filter Pills */}
          <div className="mt-3 flex items-center gap-1 rounded-xl bg-muted/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "flex-1 rounded-lg py-1 font-semibold transition-all",
                filter === "all"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "flex-1 rounded-lg py-1 font-semibold transition-all",
                filter === "unread"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </SheetHeader>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredList.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                <Bell className="h-6 w-6 opacity-40" />
              </div>
              <h3 className="mt-3 text-xs font-semibold text-foreground">
                {filter === "unread" ? "No unread notifications" : "All caught up!"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {filter === "unread"
                  ? "You have marked all notifications as read."
                  : "You will receive alerts here when sessions start or attendance updates."}
              </p>
            </div>
          ) : (
            filteredList.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={cn(
                  "group relative flex cursor-pointer gap-3 rounded-2xl border p-3.5 transition-all active:scale-[0.98]",
                  item.read
                    ? "border-border/50 bg-card/60 hover:bg-card"
                    : "border-primary/30 bg-primary/[0.03] shadow-2xs hover:bg-primary/[0.06]",
                )}
              >
                {/* Type Icon */}
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                    getNotificationBadgeTone(item.type),
                  )}
                >
                  {getNotificationIcon(item.type)}
                </div>

                {/* Body */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4
                      className={cn(
                        "text-xs leading-snug text-foreground",
                        item.read ? "font-medium" : "font-bold",
                      )}
                    >
                      {item.title}
                    </h4>
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {item.message}
                  </p>

                  {item.link && (
                    <div className="pt-1 flex items-center gap-1 text-[11px] font-bold text-primary">
                      <span>View details</span>
                      <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  )}
                </div>

                {/* Unread indicator dot */}
                {!item.read && (
                  <span className="absolute top-3.5 right-3.5 h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
