import { getSupabase } from "@/lib/supabase";

export interface SendSessionStartEmailParams {
  sessionId: string;
}

export interface EmailDispatchResult {
  success: boolean;
  sentCount: number;
  error?: string;
}

function getSessionStartEndpoint(): string {
  const explicitEndpoint = import.meta.env.VITE_EMAIL_SESSION_START_ENDPOINT as string | undefined;
  if (explicitEndpoint) return explicitEndpoint;

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
  return `${apiBaseUrl ?? ""}/api/email/session-start`;
}

export interface WelcomeEmailParams {
  type: "student_welcome" | "lecturer_pending" | "lecturer_approved" | "lecturer_rejected" | "admin_welcome" | "admin_new_lecturer_alert";
  email: string;
  name: string;
  regNumber?: string;
  staffId?: string;
  department?: string;
  faculty?: string;
  level?: string;
  reason?: string;
}

export const emailService = {
  async sendWelcomeEmail(payload: WelcomeEmailParams): Promise<EmailDispatchResult> {
    try {
      const response = await fetch("/api/email/welcome", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) {
        console.warn("[EmailService] Welcome email dispatch non-critical error:", result.error);
        return {
          success: false,
          sentCount: 0,
          error: result.error ?? "Failed to send email",
        };
      }

      return { success: true, sentCount: 1 };
    } catch (err) {
      console.warn("[EmailService] Exception during welcome email dispatch:", err);
      return {
        success: false,
        sentCount: 0,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  },

  async sendSessionStartEmail({ sessionId }: SendSessionStartEmailParams): Promise<EmailDispatchResult> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, sentCount: 0, error: "Supabase is not configured." };
    }

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      return { success: false, sentCount: 0, error: "Authentication is required." };
    }

    const response = await fetch(getSessionStartEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });

    const result = (await response.json().catch(() => ({}))) as Partial<EmailDispatchResult>;
    if (!response.ok) {
      return {
        success: false,
        sentCount: 0,
        error: result.error ?? "Email notification could not be dispatched.",
      };
    }

    return {
      success: result.success === true,
      sentCount: Number(result.sentCount ?? 0),
    };
  },
};

