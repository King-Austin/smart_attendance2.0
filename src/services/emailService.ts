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

export const emailService = {
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
