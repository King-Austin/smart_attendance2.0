import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendEmailDirect } from "@/lib/resendClient";
import { getGuardianAbsenceEmail, getGuardianRegistrationEmail } from "@/lib/emailTemplates";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const Route = createFileRoute("/api/email/guardian")({
  server: { handlers: { POST: async ({ request }) => {
    if (!url || !serviceKey) return json({ success: false, error: "Email service is not configured." }, 503);
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, error: "Authentication required." }, 401);
    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await sb.auth.getUser(token);
    if (authError || !auth.user) return json({ success: false, error: "Invalid authentication." }, 401);
    const body = await request.json().catch(() => ({})) as { action?: string; courseId?: string };
    const { data: caller } = await sb.from("profiles").select("*").eq("id", auth.user.id).single();
    if (!caller) return json({ success: false, error: "Profile not found." }, 403);

    if (body.action === "registration_confirmation") {
      if (caller.role !== "student") return json({ success: false, error: "Student access required." }, 403);
      const { data: prior } = await sb.from("guardian_email_events").select("id").eq("student_id", caller.id).eq("event_type", "registration_confirmation").eq("status", "sent").maybeSingle();
      if (prior) return json({ success: true, sentCount: 0, skippedCount: 1, failedCount: 0 });
      const template = getGuardianRegistrationEmail({ guardianName: caller.guardian_name, studentName: caller.name, regNumber: caller.reg_number, department: caller.department });
      const result = await sendEmailDirect({ to: caller.guardian_email, ...template });
      await sb.from("guardian_email_events").insert({ student_id: caller.id, event_type: "registration_confirmation", status: result.success ? "sent" : "failed", provider_message_id: result.id ?? null, failure_summary: result.error?.slice(0, 500) ?? null });
      return json({ success: result.success, sentCount: result.success ? 1 : 0, skippedCount: 0, failedCount: result.success ? 0 : 1, error: result.success ? undefined : "Guardian confirmation could not be delivered." }, result.success ? 200 : 502);
    }

    if (body.action !== "consecutive_absence" || !body.courseId) return json({ success: false, error: "Invalid guardian email action." }, 400);
    const allowed = caller.role === "admin" || (caller.role === "lecturer" && caller.approval_status === "approved" && (caller.course_ids ?? []).includes(body.courseId));
    if (!allowed) return json({ success: false, error: "You are not authorized for this course." }, 403);
    const { data: course } = await sb.from("courses").select("id,code,title").eq("id", body.courseId).single();
    const { data: sessions } = await sb.from("attendance_sessions").select("id").eq("course_id", body.courseId).eq("status", "ended").order("created_at", { ascending: false }).limit(5);
    if (!course || !sessions || sessions.length < 5) return json({ success: true, sentCount: 0, skippedCount: 1, failedCount: 0 });
    const sessionIds = sessions.map((item) => item.id);
    const { data: students } = await sb.from("profiles").select("id,name,guardian_name,guardian_email,course_ids").eq("role", "student").contains("course_ids", [body.courseId]);
    let sentCount = 0, skippedCount = 0, failedCount = 0;
    for (const student of students ?? []) {
      if (!student.guardian_email) { skippedCount++; continue; }
      const { count } = await sb.from("attendance_records").select("id", { count: "exact", head: true }).eq("student_id", student.id).eq("status", "verified").in("session_id", sessionIds);
      if ((count ?? 0) > 0) { skippedCount++; continue; }
      const { data: lastEvent } = await sb.from("guardian_email_events").select("created_at").eq("student_id", student.id).eq("course_id", body.courseId).eq("event_type", "consecutive_absence").eq("status", "sent").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (lastEvent) {
        const { count: attendanceAfter } = await sb.from("attendance_records").select("id", { count: "exact", head: true }).eq("student_id", student.id).eq("course_id", body.courseId).eq("status", "verified").gt("created_at", lastEvent.created_at);
        if ((attendanceAfter ?? 0) === 0) { skippedCount++; continue; }
      }
      const template = getGuardianAbsenceEmail({ guardianName: student.guardian_name || "Guardian", studentName: student.name, courseCode: course.code, courseTitle: course.title, absenceCount: 5 });
      const result = await sendEmailDirect({ to: student.guardian_email, ...template });
      await sb.from("guardian_email_events").insert({ student_id: student.id, course_id: body.courseId, event_type: "consecutive_absence", status: result.success ? "sent" : "failed", provider_message_id: result.id ?? null, failure_summary: result.error?.slice(0, 500) ?? null });
      result.success ? sentCount++ : failedCount++;
    }
    return json({ success: failedCount === 0, sentCount, skippedCount, failedCount, error: failedCount ? "Some guardian notices could not be delivered." : undefined });
  } } },
});
