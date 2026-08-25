/**
 * Direct HTTP Client for Resend API
 * Safe for server runtime and edge environments.
 */

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export interface ResendResponse {
  id?: string;
  error?: {
    message: string;
    name: string;
    statusCode?: number;
  };
}

export async function sendEmailDirect(payload: SendEmailPayload): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey =
    process.env.RESEND_API_KEY ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_RESEND_API_KEY);

  if (!apiKey) {
    console.error("[Resend] API key is missing. Ensure RESEND_API_KEY is configured in .env");
    return { success: false, error: "Resend API key is not configured." };
  }

  const senderEmail =
    process.env.RESEND_FROM_EMAIL ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_RESEND_FROM_EMAIL) ||
    "support@websyncdigital.com.ng";

  const senderName =
    process.env.EMAIL_SENDER_NAME ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_EMAIL_SENDER_NAME) ||
    "Smart Campus Presence";

  const fromFormatted = payload.from || `${senderName} <${senderEmail}>`;

  try {
    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
    
    // Filter out invalid/empty email recipients
    const validRecipients = recipients.filter((email) => email && email.includes("@"));
    if (validRecipients.length === 0) {
      return { success: false, error: "No valid recipient email address provided." };
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromFormatted,
        to: validRecipients,
        subject: payload.subject,
        html: payload.html,
        reply_to: payload.replyTo || senderEmail,
      }),
    });

    const data = (await res.json()) as ResendResponse;

    if (!res.ok || data.error) {
      const errMsg = data.error?.message || `HTTP ${res.status} ${res.statusText}`;
      console.error("[Resend] Failed to send email:", errMsg);
      return { success: false, error: errMsg };
    }

    return { success: true, id: data.id };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown network error";
    console.error("[Resend] Exception during email transmission:", errMsg);
    return { success: false, error: errMsg };
  }
}
