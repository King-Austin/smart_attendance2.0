import type { AttendanceSession, Course } from "@/types";

const RESEND_API_KEY =
  import.meta.env.VITE_RESEND_API_KEY ||
  import.meta.env.RESEND_API_KEY ||
  "re_Le71SsrY_NNjq67E7wgCbGpf1VTTZcmPu";

const SENDER_EMAIL =
  import.meta.env.VITE_RESEND_FROM_EMAIL ||
  import.meta.env.RESEND_FROM_EMAIL ||
  "support@websyncdigital.com.ng";

const SENDER_NAME = import.meta.env.VITE_EMAIL_SENDER_NAME || "Smart Attendance";

const APP_URL = import.meta.env.VITE_APP_URL || "http://localhost:5173";

export interface SendSessionStartEmailParams {
  session: AttendanceSession;
  course?: Course;
  recipients: string[];
}

export interface SendAbsenceWarningParams {
  studentName: string;
  regNumber: string;
  courseCode: string;
  courseTitle: string;
  missedCount: number;
  recipients: string[];
}

export const emailService = {
  /**
   * Dispatches transactional email via Resend REST API
   */
  async sendEmail(params: {
    to: string | string[];
    subject: string;
    html: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!RESEND_API_KEY) {
      console.warn("Resend API key is missing. Email dispatch skipped.");
      return { success: false, error: "API key missing" };
    }

    const recipientList = Array.isArray(params.to) ? params.to : [params.to];
    const validEmails = recipientList.filter(
      (email) => email && typeof email === "string" && email.includes("@"),
    );

    if (validEmails.length === 0) {
      return { success: false, error: "No valid recipient email provided." };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
          to: validEmails,
          subject: params.subject,
          html: params.html,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.warn("Resend email dispatch error:", result);
        return { success: false, error: result.message || "Failed to send email" };
      }

      console.info("Resend email dispatched successfully:", result);
      return { success: true, data: result };
    } catch (err) {
      console.error("Network error during Resend email dispatch:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  },

  /**
   * Sends lecture start broadcast to all students registered in the course.
   */
  async sendSessionStartEmail({
    session,
    course,
    recipients,
  }: SendSessionStartEmailParams): Promise<{ success: boolean; sentCount: number }> {
    if (!recipients || recipients.length === 0) {
      return { success: false, sentCount: 0 };
    }

    const courseCode = course?.code || session.courseId;
    const courseTitle = course?.title || session.topic || "Lecture Session";
    const topic = session.topic || "Lecture & Attendance Verification";
    const checkInUrl = `${APP_URL}/student/dashboard`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Attendance — New Lecture Started</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #090d16;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f1f5f9;
    }
    .wrapper {
      max-width: 560px;
      margin: 30px auto;
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 15px 35px rgba(0,0,0,0.5);
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      padding: 28px 24px;
      text-align: center;
    }
    .logo-badge {
      display: inline-block;
      background-color: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 12px;
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #ffffff;
      margin-bottom: 8px;
    }
    .title {
      margin: 0;
      color: #ffffff;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .content {
      padding: 28px 24px;
    }
    .card {
      background-color: #1e293b;
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 22px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 7px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 13px;
    }
    .row:last-child {
      border-bottom: none;
    }
    .label {
      color: #94a3b8;
      font-weight: 500;
    }
    .val {
      color: #f8fafc;
      font-weight: 600;
      text-align: right;
    }
    .cta-container {
      text-align: center;
      margin: 28px 0 10px 0;
    }
    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      padding: 13px 32px;
      border-radius: 12px;
      box-shadow: 0 4px 14px rgba(37,99,235,0.4);
    }
    .footer {
      background-color: #0b1120;
      padding: 18px 24px;
      text-align: center;
      border-top: 1px solid #1e293b;
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo-badge">Smart Attendance</div>
      <h1 class="title">Live Lecture Session Started</h1>
    </div>
    <div class="content">
      <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-top: 0;">
        An attendance verification session has just been launched for your enrolled course. Please open your Smart Attendance app to verify your presence.
      </p>

      <div class="card">
        <div class="row">
          <span class="label">Course</span>
          <span class="val">${courseCode} — ${courseTitle}</span>
        </div>
        <div class="row">
          <span class="label">Topic</span>
          <span class="val">${topic}</span>
        </div>
        <div class="row">
          <span class="label">Lecturer</span>
          <span class="val">${session.lecturerName || "Lecturer"}</span>
        </div>
        <div class="row">
          <span class="label">Start Time</span>
          <span class="val">${session.date} · ${session.startTime}</span>
        </div>
        <div class="row">
          <span class="label">Verification Radius</span>
          <span class="val">${session.radius} meters</span>
        </div>
      </div>

      <div class="cta-container">
        <a href="${checkInUrl}" class="cta-btn" target="_blank">Open App & Check In</a>
      </div>
    </div>
    <div class="footer">
      This is an automated notification from <strong>Smart Attendance</strong>.<br>
      Department of Electrical & Electronic Engineering.
    </div>
  </div>
</body>
</html>
`;

    // Process recipients (chunks of up to 50 for Resend batch API compliance)
    const chunkSize = 50;
    let sentCount = 0;

    for (let i = 0; i < recipients.length; i += chunkSize) {
      const batch = recipients.slice(i, i + chunkSize);
      const res = await this.sendEmail({
        to: batch,
        subject: `Smart Attendance: ${courseCode} lecture session started`,
        html: htmlContent,
      });

      if (res.success) {
        sentCount += batch.length;
      }
    }

    return { success: sentCount > 0, sentCount };
  },

  /**
   * Sends an absence warning alert to a student and optionally their guardian.
   */
  async sendAbsenceWarningEmail({
    studentName,
    regNumber,
    courseCode,
    courseTitle,
    missedCount,
    recipients,
  }: SendAbsenceWarningParams): Promise<{ success: boolean }> {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Smart Attendance — Attendance Advisory</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #090d16;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #f1f5f9;
    }
    .wrapper {
      max-width: 560px;
      margin: 30px auto;
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 20px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%);
      padding: 24px;
      text-align: center;
      color: #ffffff;
    }
    .content {
      padding: 24px;
    }
    .card {
      background-color: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px;
      margin: 18px 0;
    }
    .footer {
      background-color: #0b1120;
      padding: 16px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h2 style="margin:0; font-size: 20px;">Attendance Advisory Warning</h2>
    </div>
    <div class="content">
      <p style="color: #cbd5e1; font-size: 14px;">
        Dear <strong>${studentName}</strong> (${regNumber}),
      </p>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
        You have recorded <strong style="color:#f87171;">${missedCount} consecutive absences</strong> in <strong>${courseCode} (${courseTitle})</strong>.
      </p>
      <div class="card">
        <p style="margin:0; font-size:13px; color:#94a3b8;">
          Academic regulations require a minimum 75% verified turnout to qualify for the final semester examination. Please consult your course lecturer or department coordinator.
        </p>
      </div>
    </div>
    <div class="footer">
      Automated notice from <strong>Smart Attendance</strong>.
    </div>
  </div>
</body>
</html>
`;

    const res = await this.sendEmail({
      to: recipients,
      subject: `Smart Attendance Warning: ${missedCount} consecutive absences in ${courseCode}`,
      html: htmlContent,
    });

    return { success: res.success };
  },
};
