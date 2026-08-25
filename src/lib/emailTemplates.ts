/**
 * Responsive, branded HTML Email Templates for Smart Campus Presence
 */

const BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #1e293b;
  background-color: #f8fafc;
  margin: 0;
  padding: 0;
`;

const CARD_STYLES = `
  max-width: 580px;
  margin: 32px auto;
  background-color: #ffffff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
`;

const HEADER_STYLES = `
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  padding: 32px 28px;
  text-align: center;
  color: #ffffff;
`;

const BODY_STYLES = `
  padding: 32px 28px;
`;

const FOOTER_STYLES = `
  background-color: #f8fafc;
  padding: 20px 28px;
  border-top: 1px solid #e2e8f0;
  text-align: center;
  font-size: 12px;
  color: #64748b;
`;

const BUTTON_PRIMARY = `
  display: inline-block;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff !important;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  padding: 12px 28px;
  border-radius: 8px;
  margin: 20px 0;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
`;

const STEP_CARD = `
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
`;

// Helper for escaping strings
function escapeHtml(str?: string | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// -------------------------------------------------------------
// 1. Student Welcome Email
// -------------------------------------------------------------
export interface StudentWelcomeParams {
  name: string;
  regNumber?: string;
  department?: string;
  level?: string;
  appUrl?: string;
}

export function getStudentWelcomeEmail(params: StudentWelcomeParams): { subject: string; html: string } {
  const name = escapeHtml(params.name);
  const regNumber = escapeHtml(params.regNumber);
  const appUrl = params.appUrl || "http://localhost:5173";

  return {
    subject: `🎓 Welcome to Smart Campus Presence, ${name}!`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Smart Campus Presence</title>
</head>
<body style="${BASE_STYLES}">
  <div style="${CARD_STYLES}">
    <div style="${HEADER_STYLES}">
      <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;">
        <span style="font-size: 24px;">🏛️</span>
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Smart Campus Presence</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Biometric & Geofenced Attendance System</p>
    </div>

    <div style="${BODY_STYLES}">
      <h2 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0;">Welcome aboard, ${name}!</h2>
      <p style="font-size: 14px; color: #334155; margin-bottom: 20px;">
        Your student attendance profile has been registered successfully${regNumber ? ` under Registration Number <strong>${regNumber}</strong>` : ""}.
      </p>

      <p style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 12px;">
        Please complete these essential onboarding steps to ensure smooth attendance verification:
      </p>

      <div style="${STEP_CARD}">
        <div style="display: flex; align-items: flex-start;">
          <div style="background-color: #dbeafe; color: #1d4ed8; font-weight: 700; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; margin-right: 12px; flex-shrink: 0;">1</div>
          <div>
            <strong style="font-size: 14px; color: #0f172a;">📚 Set Up Your Courses</strong>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
              Ensure your departmental courses for the current semester are fully selected in your profile so attendance prompts trigger correctly.
            </p>
          </div>
        </div>
      </div>

      <div style="${STEP_CARD}">
        <div style="display: flex; align-items: flex-start;">
          <div style="background-color: #dbeafe; color: #1d4ed8; font-weight: 700; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; margin-right: 12px; flex-shrink: 0;">2</div>
          <div>
            <strong style="font-size: 14px; color: #0f172a;">👤 Enroll Your Face Biometrics</strong>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
              Capture your official facial biometric profile with good lighting to enable instant live verification during lecture sessions.
            </p>
          </div>
        </div>
      </div>

      <div style="${STEP_CARD}">
        <div style="display: flex; align-items: flex-start;">
          <div style="background-color: #dbeafe; color: #1d4ed8; font-weight: 700; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; margin-right: 12px; flex-shrink: 0;">3</div>
          <div>
            <strong style="font-size: 14px; color: #0f172a;">📍 Enable App Permissions</strong>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
              Grant camera and high-precision GPS location permissions to allow the geofence to validate your classroom presence.
            </p>
          </div>
        </div>
      </div>

      <div style="${STEP_CARD}">
        <div style="display: flex; align-items: flex-start;">
          <div style="background-color: #dbeafe; color: #1d4ed8; font-weight: 700; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; margin-right: 12px; flex-shrink: 0;">4</div>
          <div>
            <strong style="font-size: 14px; color: #0f172a;">✉️ Review Official Notices & Letters</strong>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
              Stay updated with academic attendance policies, minimum threshold warnings (75%), and official departmental letters.
            </p>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/student/dashboard" style="${BUTTON_PRIMARY}">Go to Student Dashboard</a>
      </div>
    </div>

    <div style="${FOOTER_STYLES}">
      <p style="margin: 0;">Smart Campus Presence System &bull; Institutional Academic Records</p>
      <p style="margin: 4px 0 0 0;">Need assistance? Reply directly to this email or contact support.</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

// -------------------------------------------------------------
// 2. Lecturer Pending Welcome Email
// -------------------------------------------------------------
export interface LecturerPendingParams {
  name: string;
  staffId?: string;
  department?: string;
  faculty?: string;
  appUrl?: string;
}

export function getLecturerPendingEmail(params: LecturerPendingParams): { subject: string; html: string } {
  const name = escapeHtml(params.name);
  const staffId = escapeHtml(params.staffId);
  const appUrl = params.appUrl || "http://localhost:5173";

  return {
    subject: `📋 Account Registration Received — Verification Pending (Smart Campus)`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lecturer Account Verification</title>
</head>
<body style="${BASE_STYLES}">
  <div style="${CARD_STYLES}">
    <div style="${HEADER_STYLES}">
      <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;">
        <span style="font-size: 24px;">👨‍🏫</span>
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Smart Campus Presence</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Faculty & Lecturer Portal</p>
    </div>

    <div style="${BODY_STYLES}">
      <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center;">
          <span style="font-size: 20px; margin-right: 10px;">⏳</span>
          <div>
            <strong style="color: #92400e; font-size: 14px;">Account Status: Pending Administrative Verification</strong>
          </div>
        </div>
      </div>

      <h2 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0;">Welcome, ${name}!</h2>
      <p style="font-size: 14px; color: #334155;">
        Thank you for creating your lecturer profile${staffId ? ` (Staff ID: <strong>${staffId}</strong>)` : ""}. Your application has been logged and is awaiting verification by the institution administrator.
      </p>

      <div style="background-color: #f1f5f9; border-radius: 10px; padding: 16px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <p style="margin: 0; font-size: 14px; color: #1e293b; font-weight: 500;">
          📌 <strong>What happens next?</strong>
        </p>
        <p style="margin: 8px 0 0 0; font-size: 13px; color: #475569;">
          Once your lecturer status is verified and approved by the administrator, you will receive a confirmation email and will immediately be able to:
        </p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #475569;">
          <li>Add and manage your assigned departmental courses</li>
          <li>Initiate geofenced live attendance sessions with GPS coordinates</li>
          <li>Monitor real-time biometric student check-ins and export certified ledgers</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/lecturer/dashboard" style="${BUTTON_PRIMARY}">View Portal Status</a>
      </div>
    </div>

    <div style="${FOOTER_STYLES}">
      <p style="margin: 0;">Smart Campus Presence System &bull; Institutional Academic Records</p>
      <p style="margin: 4px 0 0 0;">Need immediate verification? Contact your departmental administrator.</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

// -------------------------------------------------------------
// 3. Lecturer Approved Email
// -------------------------------------------------------------
export interface LecturerApprovedParams {
  name: string;
  staffId?: string;
  department?: string;
  appUrl?: string;
}

export function getLecturerApprovedEmail(params: LecturerApprovedParams): { subject: string; html: string } {
  const name = escapeHtml(params.name);
  const staffId = escapeHtml(params.staffId);
  const appUrl = params.appUrl || "http://localhost:5173";

  return {
    subject: `✅ Lecturer Account Approved — Start Creating Attendance Sessions!`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lecturer Account Approved</title>
</head>
<body style="${BASE_STYLES}">
  <div style="${CARD_STYLES}">
    <div style="${HEADER_STYLES}">
      <div style="display: inline-block; background-color: #10b981; border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;">
        <span style="font-size: 24px;">✨</span>
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Account Approved</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #a7f3d0;">Smart Campus Presence System</p>
    </div>

    <div style="${BODY_STYLES}">
      <h2 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0;">Congratulations, ${name}!</h2>
      <p style="font-size: 14px; color: #334155;">
        Your lecturer account${staffId ? ` (Staff ID: <strong>${staffId}</strong>)` : ""} has been <strong>officially approved and verified</strong> by the university administrator.
      </p>

      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; color: #065f46; font-weight: 600;">
          🚀 You are now ready to:
        </p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #047857;">
          <li>Add and configure your courses from the master catalog</li>
          <li>Launch live geofenced attendance sessions right in the classroom</li>
          <li>Track real-time biometric student check-ins with anti-spoofing protection</li>
          <li>Export attendance reports (PDF/Excel) for administrative records</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/lecturer/create-session" style="${BUTTON_PRIMARY}">Create First Attendance Session</a>
      </div>
    </div>

    <div style="${FOOTER_STYLES}">
      <p style="margin: 0;">Smart Campus Presence System &bull; Institutional Academic Records</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

// -------------------------------------------------------------
// 4. Lecturer Rejected Email
// -------------------------------------------------------------
export interface LecturerRejectedParams {
  name: string;
  staffId?: string;
  reason?: string;
  appUrl?: string;
}

export function getLecturerRejectedEmail(params: LecturerRejectedParams): { subject: string; html: string } {
  const name = escapeHtml(params.name);
  const reason = escapeHtml(params.reason);

  return {
    subject: `⚠️ Update on your Smart Campus Presence Lecturer Registration`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lecturer Account Review Update</title>
</head>
<body style="${BASE_STYLES}">
  <div style="${CARD_STYLES}">
    <div style="${HEADER_STYLES}">
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">Smart Campus Presence</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Lecturer Profile Verification</p>
    </div>

    <div style="${BODY_STYLES}">
      <h2 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0;">Dear ${name},</h2>
      <p style="font-size: 14px; color: #334155;">
        Your lecturer registration could not be approved at this time during the administrative verification process.
      </p>

      ${
        reason
          ? `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 16px; margin: 20px 0;">
        <strong style="font-size: 13px; color: #991b1b;">Administrative Note:</strong>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #b91c1c;">${reason}</p>
      </div>`
          : ""
      }

      <p style="font-size: 14px; color: #475569;">
        If you believe this is an error or need to update your Staff ID or departmental credentials, please contact your university system administrator or reply to this email.
      </p>
    </div>

    <div style="${FOOTER_STYLES}">
      <p style="margin: 0;">Smart Campus Presence System &bull; Institutional Academic Records</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

// -------------------------------------------------------------
// 5. Admin Welcome Email
// -------------------------------------------------------------
export interface AdminWelcomeParams {
  name: string;
  email: string;
  appUrl?: string;
}

export function getAdminWelcomeEmail(params: AdminWelcomeParams): { subject: string; html: string } {
  const name = escapeHtml(params.name);
  const appUrl = params.appUrl || "http://localhost:5173";

  return {
    subject: `🛡️ Administrator Account Initialized — Smart Campus Presence`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Account Initialized</title>
</head>
<body style="${BASE_STYLES}">
  <div style="${CARD_STYLES}">
    <div style="${HEADER_STYLES}">
      <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;">
        <span style="font-size: 24px;">🛡️</span>
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Institutional Administration</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Smart Campus Presence Control Center</p>
    </div>

    <div style="${BODY_STYLES}">
      <h2 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0;">Welcome, ${name}!</h2>
      <p style="font-size: 14px; color: #334155;">
        Your system administrator account has been successfully initialized. You have complete institutional privileges over the Smart Campus Presence platform.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
        <strong style="font-size: 14px; color: #0f172a;">Key Administrator Capabilities:</strong>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #475569;">
          <li>Review and approve new faculty/lecturer registrations</li>
          <li>Manage the institutional master course catalog across all departments</li>
          <li>Monitor student face enrollment status and guardian notification coverage</li>
          <li>Access comprehensive audit logs for attendance and geofence integrity</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/admin/dashboard" style="${BUTTON_PRIMARY}">Open Administrator Dashboard</a>
      </div>
    </div>

    <div style="${FOOTER_STYLES}">
      <p style="margin: 0;">Smart Campus Presence System &bull; Security & Administration</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

// -------------------------------------------------------------
// 6. Admin New Lecturer Alert Email
// -------------------------------------------------------------
export interface AdminNewLecturerAlertParams {
  lecturerName: string;
  lecturerEmail: string;
  staffId?: string;
  department?: string;
  faculty?: string;
  appUrl?: string;
}

export function getAdminNewLecturerAlertEmail(params: AdminNewLecturerAlertParams): { subject: string; html: string } {
  const lecturerName = escapeHtml(params.lecturerName);
  const lecturerEmail = escapeHtml(params.lecturerEmail);
  const staffId = escapeHtml(params.staffId);
  const department = escapeHtml(params.department);
  const faculty = escapeHtml(params.faculty);
  const appUrl = params.appUrl || "http://localhost:5173";

  return {
    subject: `🔔 Action Required: New Lecturer Registration Awaiting Approval (${lecturerName})`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lecturer Awaiting Approval</title>
</head>
<body style="${BASE_STYLES}">
  <div style="${CARD_STYLES}">
    <div style="${HEADER_STYLES}">
      <div style="display: inline-block; background-color: #f59e0b; border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;">
        <span style="font-size: 24px;">📢</span>
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Pending Lecturer Approval</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #fde68a;">Admin Notification Alert</p>
    </div>

    <div style="${BODY_STYLES}">
      <h2 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0;">A new faculty member has registered</h2>
      <p style="font-size: 14px; color: #334155;">
        A new lecturer account has been created on Smart Campus Presence and requires administrative review and approval before they can create attendance sessions:
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 110px;"><strong>Full Name:</strong></td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${lecturerName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Email:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">${lecturerEmail}</td>
          </tr>
          ${
            staffId
              ? `<tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Staff ID:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">${staffId}</td>
          </tr>`
              : ""
          }
          ${
            department
              ? `<tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Department:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">${department}</td>
          </tr>`
              : ""
          }
          ${
            faculty
              ? `<tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Faculty:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">${faculty}</td>
          </tr>`
              : ""
          }
        </table>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/admin/dashboard" style="${BUTTON_PRIMARY}">Review & Approve in Admin Dashboard</a>
      </div>
    </div>

    <div style="${FOOTER_STYLES}">
      <p style="margin: 0;">Smart Campus Presence System &bull; Institutional Administration</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}
