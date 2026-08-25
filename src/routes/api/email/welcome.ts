import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendEmailDirect } from "@/lib/resendClient";
import {
  getStudentWelcomeEmail,
  getLecturerPendingEmail,
  getLecturerApprovedEmail,
  getLecturerRejectedEmail,
  getAdminWelcomeEmail,
  getAdminNewLecturerAlertEmail,
} from "@/lib/emailTemplates";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL);

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  (typeof import.meta !== "undefined" && import.meta.env?.SUPABASE_SERVICE_ROLE_KEY);

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export type EmailActionType =
  | "student_welcome"
  | "lecturer_pending"
  | "lecturer_approved"
  | "lecturer_rejected"
  | "admin_welcome"
  | "admin_new_lecturer_alert";

interface EmailDispatchPayload {
  type: EmailActionType;
  email: string;
  name: string;
  regNumber?: string;
  staffId?: string;
  department?: string;
  faculty?: string;
  level?: string;
  reason?: string;
  appUrl?: string;
}

export const Route = createFileRoute("/api/email/welcome")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await readBody(request)) as unknown as EmailDispatchPayload;
        const { type, email, name } = body;

        if (!type || !email) {
          return json({ error: "Missing required fields: 'type' and 'email' are mandatory." }, 400);
        }

        const appUrl =
          body.appUrl ||
          process.env.VITE_APP_URL ||
          (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_URL) ||
          "http://localhost:5173";

        try {
          switch (type) {
            case "student_welcome": {
              const { subject, html } = getStudentWelcomeEmail({
                name: name || "Student",
                regNumber: body.regNumber,
                department: body.department,
                level: body.level,
                appUrl,
              });
              const result = await sendEmailDirect({ to: email, subject, html });
              return json({ ok: result.success, id: result.id, error: result.error });
            }

            case "lecturer_pending": {
              // 1. Send pending notice to the newly registered lecturer
              const lecturerTemplate = getLecturerPendingEmail({
                name: name || "Lecturer",
                staffId: body.staffId,
                department: body.department,
                faculty: body.faculty,
                appUrl,
              });
              const lecturerResult = await sendEmailDirect({
                to: email,
                subject: lecturerTemplate.subject,
                html: lecturerTemplate.html,
              });

              // 2. Also proactively notify institutional admins about this new registration
              const sb = getAdminClient();
              let adminEmails: string[] = [];
              if (sb) {
                const { data } = await sb
                  .from("profiles")
                  .select("email")
                  .eq("role", "admin");
                if (data && data.length > 0) {
                  adminEmails = data.map((d) => d.email).filter(Boolean);
                }
              }

              // If admins are found in DB, dispatch alert to them
              if (adminEmails.length > 0) {
                const adminAlertTemplate = getAdminNewLecturerAlertEmail({
                  lecturerName: name || "New Lecturer",
                  lecturerEmail: email,
                  staffId: body.staffId,
                  department: body.department,
                  faculty: body.faculty,
                  appUrl,
                });
                await sendEmailDirect({
                  to: adminEmails,
                  subject: adminAlertTemplate.subject,
                  html: adminAlertTemplate.html,
                });
              }

              return json({ ok: lecturerResult.success, id: lecturerResult.id, error: lecturerResult.error });
            }

            case "lecturer_approved": {
              const { subject, html } = getLecturerApprovedEmail({
                name: name || "Lecturer",
                staffId: body.staffId,
                department: body.department,
                appUrl,
              });
              const result = await sendEmailDirect({ to: email, subject, html });
              return json({ ok: result.success, id: result.id, error: result.error });
            }

            case "lecturer_rejected": {
              const { subject, html } = getLecturerRejectedEmail({
                name: name || "Lecturer",
                staffId: body.staffId,
                reason: body.reason,
                appUrl,
              });
              const result = await sendEmailDirect({ to: email, subject, html });
              return json({ ok: result.success, id: result.id, error: result.error });
            }

            case "admin_welcome": {
              const { subject, html } = getAdminWelcomeEmail({
                name: name || "Administrator",
                email,
                appUrl,
              });
              const result = await sendEmailDirect({ to: email, subject, html });
              return json({ ok: result.success, id: result.id, error: result.error });
            }

            case "admin_new_lecturer_alert": {
              const { subject, html } = getAdminNewLecturerAlertEmail({
                lecturerName: name || "New Lecturer",
                lecturerEmail: email,
                staffId: body.staffId,
                department: body.department,
                faculty: body.faculty,
                appUrl,
              });
              const result = await sendEmailDirect({ to: email, subject, html });
              return json({ ok: result.success, id: result.id, error: result.error });
            }

            default:
              return json({ error: `Unknown email action type: '${type}'` }, 400);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to process email dispatch";
          console.error("[Email API Error]", message);
          return json({ error: message }, 500);
        }
      },
    },
  },
});
