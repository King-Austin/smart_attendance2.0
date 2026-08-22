export type NotificationType =
  "session_started" | "session_ending" | "attendance_warning" | "session_summary" | "system";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  link?: string;
  metadata?: {
    sessionId?: string;
    courseCode?: string;
    turnoutPct?: number;
    [key: string]: any;
  };
}
