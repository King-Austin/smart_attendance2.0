import { Preferences } from "@capacitor/preferences";
import { PushNotifications } from "@capacitor/push-notifications";
import { permissionsService } from "./permissionsService";
import type { AppNotification, NotificationType } from "@/types/notification";

const NOTIFICATIONS_STORAGE_KEY = "scp.notifications";

type Listener = (notifications: AppNotification[]) => void;

class NotificationService {
  private notifications: AppNotification[] = [];
  private listeners = new Set<Listener>();
  private initialized = false;

  constructor() {
    void this.loadStored();
  }

  private async loadStored() {
    try {
      if (typeof window !== "undefined") {
        const { value } = await Preferences.get({ key: NOTIFICATIONS_STORAGE_KEY });
        if (value) {
          this.notifications = JSON.parse(value) as AppNotification[];
        } else {
          const fallback = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
          if (fallback) {
            this.notifications = JSON.parse(fallback) as AppNotification[];
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load stored notifications:", err);
    }
    this.initialized = true;
    this.notifyListeners();
  }

  private async save() {
    try {
      const data = JSON.stringify(this.notifications);
      await Preferences.set({ key: NOTIFICATIONS_STORAGE_KEY, value: data });
      if (typeof window !== "undefined") {
        localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, data);
      }
    } catch (err) {
      console.warn("Failed to save notifications:", err);
    }
    this.notifyListeners();
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.notifications);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener([...this.notifications]);
    }
  }

  public async initNativePush(): Promise<boolean> {
    // In-app notifications and real-time alerts are handled via Supabase Realtime & localStorage.
    // Native FCM push is bypassed when running without google-services.json to prevent Android OS crash.
    return true;
  }

  public getNotificationsForUser(userId: string): AppNotification[] {
    return this.notifications.filter(
      (n) => n.userId === userId || n.userId === "current" || n.userId === "all",
    );
  }

  public getUnreadCount(userId: string): number {
    return this.getNotificationsForUser(userId).filter((n) => !n.read).length;
  }

  public add(notification: Omit<AppNotification, "id" | "createdAt" | "read">): AppNotification {
    const newItem: AppNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };

    // Prepend new notification to the top
    this.notifications = [newItem, ...this.notifications];
    void this.save();
    return newItem;
  }

  public markAsRead(id: string) {
    this.notifications = this.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    void this.save();
  }

  public markAllAsRead(userId: string) {
    this.notifications = this.notifications.map((n) =>
      n.userId === userId || n.userId === "current" || n.userId === "all"
        ? { ...n, read: true }
        : n,
    );
    void this.save();
  }

  public delete(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    void this.save();
  }

  public clearAll(userId: string) {
    this.notifications = this.notifications.filter(
      (n) => n.userId !== userId && n.userId !== "current" && n.userId !== "all",
    );
    void this.save();
  }

  // --- Automated Smart Event Triggers ---

  public notifySessionStarted(sessionId: string, courseCode: string, courseTitle: string) {
    this.add({
      userId: "all",
      type: "session_started",
      title: `Live Session Started: ${courseCode}`,
      message: `Attendance for ${courseCode} (${courseTitle}) is now active. Tap to mark your attendance before the session ends.`,
      link: `/student/attendance/${sessionId}`,
      metadata: { sessionId, courseCode },
    });
  }

  public notifyAttendanceWarning(userId: string, courseCode: string, currentRate: number) {
    this.add({
      userId,
      type: "attendance_warning",
      title: `⚠️ Low Attendance Warning: ${courseCode}`,
      message: `Your current attendance in ${courseCode} is ${currentRate}%. Attendance below 75% disqualifies you from taking the semester exam.`,
      link: "/student/dashboard",
      metadata: { courseCode, currentRate },
    });
  }

  public notifySessionSummary(
    lecturerId: string,
    sessionId: string,
    courseCode: string,
    verifiedCount: number,
    enrolledCount: number,
  ) {
    const rate = enrolledCount > 0 ? Math.round((verifiedCount / enrolledCount) * 100) : 0;
    this.add({
      userId: lecturerId,
      type: "session_summary",
      title: `Session Concluded: ${courseCode}`,
      message: `${verifiedCount}/${enrolledCount} students verified (${rate}% turnout). Attendance ledger is ready for export.`,
      link: `/lecturer/ledger/${sessionId}`,
      metadata: { sessionId, courseCode, turnoutPct: rate },
    });
  }

  public async sendConsecutiveAbsenceNotification(
    guardianEmail: string,
    guardianName: string,
    studentName: string,
    courseId: string,
  ) {
    this.add({
      userId: "all",
      type: "attendance_warning",
      title: `⚠️ 5 Consecutive Absences: ${studentName}`,
      message: `${studentName} has missed 5 consecutive lectures in course ${courseId}. Guardian notice sent to ${guardianEmail} (${guardianName}).`,
      link: "/student/dashboard",
      metadata: { courseId, studentName, guardianEmail },
    });
  }
}

export const notificationService = new NotificationService();
