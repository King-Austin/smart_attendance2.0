import { getSupabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/config";
export interface EmailDispatchResult {
  success: boolean;
  sentCount: number;
  error?: string;
  skippedCount?: number;
  failedCount?: number;
}
export interface WelcomeEmailParams {
  type:
    | "student_welcome"
    | "lecturer_pending"
    | "lecturer_approved"
    | "lecturer_rejected"
    | "admin_welcome"
    | "admin_new_lecturer_alert";
  email: string;
  name: string;
  regNumber?: string;
  staffId?: string;
  department?: string;
  faculty?: string;
  level?: string;
  reason?: string;
}
async function dispatch(path: string, payload: unknown): Promise<EmailDispatchResult> {
  try {
    const { data } = await getSupabase()!.auth.getSession();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(apiUrl(path), {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      return {
        success: response.ok && (result.success === true || result.ok === true),
        sentCount: result.sentCount ?? (result.ok ? 1 : 0),
        error: result.error,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { success: false, sentCount: 0, error: "Email notification could not be delivered." };
  }
}
export const emailService = {
  sendWelcomeEmail: (payload: WelcomeEmailParams) => dispatch("/api/email/welcome", payload),
  // Session-start delivery is not implemented by the current web server; report it explicitly.
  sendSessionStartEmail: async (_payload: { sessionId: string }): Promise<EmailDispatchResult> => ({
    success: false,
    sentCount: 0,
    error: "Session-start email endpoint is unavailable; realtime notifications remain enabled.",
  }),
  sendGuardianEmail: (
    action: "registration_confirmation" | "consecutive_absence",
    courseId?: string,
  ) => dispatch("/api/email/guardian", { action, courseId }),
};
