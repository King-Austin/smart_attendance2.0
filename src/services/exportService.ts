import type { AttendanceSession, Course } from "@/types";
import { format12Hour } from "@/services/attendanceService";

export interface AttendeeExportItem {
  id?: string;
  studentName: string;
  regNumber?: string;
  department?: string;
  level?: string;
  status: string;
  verifiedAt?: string | null;
}

export interface ExportSessionStats {
  totalEnrolled: number;
  totalPresent: number;
  totalAbsent: number;
  turnoutRate: number;
}

class ExportService {
  /**
   * Generates and downloads a clean, academic CSV attendance sheet.
   * Compatible with Excel, Google Sheets, and Apple Numbers.
   */
  public exportToCSV(
    session: AttendanceSession,
    course: Course | undefined,
    attendees: AttendeeExportItem[],
  ) {
    const courseCode = course?.code ?? session.courseId;
    const courseTitle = course?.title ?? "Course";
    const sessionDate = session.startTime.split("T")[0] ?? new Date().toISOString().split("T")[0];

    // CSV Header with metadata comments
    const lines: string[] = [];
    lines.push(`Course Code,${this.escapeCSV(courseCode)}`);
    lines.push(`Course Title,${this.escapeCSV(courseTitle)}`);
    lines.push(`Lecturer,${this.escapeCSV(session.lecturerName)}`);
    lines.push(`Date,${this.escapeCSV(sessionDate)}`);
    lines.push(`Start Time,${this.escapeCSV(format12Hour(session.startTime))}`);
    lines.push(""); // blank line separator

    // Table Column Headers (Strictly Academic - No Technical GPS Distance)
    lines.push("S/N,Registration Number,Full Name,Department,Level,Check-In Time,Status");

    // Table Rows
    attendees.forEach((item, index) => {
      const sn = index + 1;
      const regNo = item.regNumber ?? "N/A";
      const name = item.studentName;
      const dept = item.department ?? "Engineering";
      const level = item.level ?? "500L";
      const time = item.verifiedAt ? format12Hour(item.verifiedAt) : "—";
      const status = item.status === "verified" || item.status === "present" ? "Present" : "Absent";

      lines.push(
        [
          sn,
          this.escapeCSV(regNo),
          this.escapeCSV(name),
          this.escapeCSV(dept),
          this.escapeCSV(level),
          this.escapeCSV(time),
          this.escapeCSV(status),
        ].join(","),
      );
    });

    const csvContent = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const filename = `Attendance_${courseCode.replace(/\s+/g, "_")}_${sessionDate}.csv`;

    this.triggerDownload(blob, filename);
  }

  /**
   * Generates a beautifully formatted, official printable academic PDF sheet.
   */
  public exportToPDF(
    session: AttendanceSession,
    course: Course | undefined,
    attendees: AttendeeExportItem[],
    stats: ExportSessionStats,
  ) {
    const courseCode = course?.code ?? session.courseId;
    const courseTitle = course?.title ?? "Course";
    const sessionDate = session.startTime.split("T")[0] ?? new Date().toISOString().split("T")[0];
    const formattedStartTime = format12Hour(session.startTime);

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to generate and print the official PDF attendance report.");
      return;
    }

    const rowsHtml = attendees
      .map((item, index) => {
        const sn = index + 1;
        const regNo = item.regNumber ?? "N/A";
        const isPresent = item.status === "verified" || item.status === "present";
        const time = item.verifiedAt ? format12Hour(item.verifiedAt) : "—";

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
            <td style="padding: 8px 10px; text-align: center; color: #64748b;">${sn}</td>
            <td style="padding: 8px 10px; font-weight: 600; font-family: monospace; color: #1e293b;">${regNo}</td>
            <td style="padding: 8px 10px; font-weight: 500; color: #0f172a;">${item.studentName}</td>
            <td style="padding: 8px 10px; color: #475569;">${item.department ?? "Engineering"}</td>
            <td style="padding: 8px 10px; color: #475569; text-align: center;">${item.level ?? "500L"}</td>
            <td style="padding: 8px 10px; color: #475569; text-align: center;">${time}</td>
            <td style="padding: 8px 10px; text-align: center;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; ${
                isPresent
                  ? "background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;"
                  : "background-color: #ffe4e6; color: #be123c; border: 1px solid #fecdd3;"
              }">
                ${isPresent ? "✓ Present" : "✗ Absent"}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Attendance Report — ${courseCode}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 24px;
            background: #fff;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <!-- Print Header & Controls -->
        <div class="no-print" style="margin-bottom: 20px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 13px; font-weight: 500; color: #475569;">Ready to save or print official report.</span>
          <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;">
            Print / Save as PDF
          </button>
        </div>

        <!-- Institutional Header -->
        <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px;">
          <h1 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800;">
            Smart Attendance System
          </h1>
          <h2 style="margin: 4px 0 0 0; font-size: 14px; font-weight: 600; color: #475569; text-transform: uppercase;">
            Department of Electrical & Electronic Engineering
          </h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b; font-weight: 500;">
            Official Verified Lecture Attendance Ledger
          </p>
        </div>

        <!-- Session Overview & Stats Box -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
          <div>
            <div style="font-size: 15px; font-weight: 700; color: #1e293b;">
              ${courseCode} — ${courseTitle}
            </div>
            <div style="margin-top: 4px; font-size: 12px; color: #475569;">
              <strong>Lecturer:</strong> ${session.lecturerName}
            </div>
            <div style="margin-top: 2px; font-size: 12px; color: #475569;">
              <strong>Date:</strong> ${sessionDate} &nbsp;|&nbsp; <strong>Start Time:</strong> ${formattedStartTime}
            </div>
          </div>
          <div style="border-left: 1px solid #cbd5e1; padding-left: 16px; display: flex; flex-direction: column; justify-content: center;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b;">Overall Turnout</div>
            <div style="font-size: 20px; font-weight: 800; color: #2563eb; margin-top: 2px;">
              ${stats.turnoutRate}%
            </div>
            <div style="font-size: 11px; color: #64748b;">
              ${stats.totalPresent} of ${stats.totalEnrolled} verified present
            </div>
          </div>
        </div>

        <!-- Attendees Table -->
        <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569;">
              <th style="padding: 8px 10px; width: 40px; text-align: center;">S/N</th>
              <th style="padding: 8px 10px; width: 120px;">Reg Number</th>
              <th style="padding: 8px 10px;">Full Name</th>
              <th style="padding: 8px 10px; width: 120px;">Department</th>
              <th style="padding: 8px 10px; width: 60px; text-align: center;">Level</th>
              <th style="padding: 8px 10px; width: 90px; text-align: center;">Check-In</th>
              <th style="padding: 8px 10px; width: 90px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Endorsement & Signature Block -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          <div>
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 35px;">
              Course Lecturer Endorsement
            </div>
            <div style="border-bottom: 1px solid #0f172a; width: 80%;"></div>
            <div style="font-size: 11px; color: #475569; margin-top: 4px;">
              Signature & Date
            </div>
          </div>
          <div>
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 35px;">
              Department Head Verification
            </div>
            <div style="border-bottom: 1px solid #0f172a; width: 80%;"></div>
            <div style="font-size: 11px; color: #475569; margin-top: 4px;">
              Stamp & Date
            </div>
          </div>
        </div>

        <script>
          // Automatically prompt print dialog on load
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  private escapeCSV(value: string | number): string {
    const stringValue = String(value ?? "");
    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();
