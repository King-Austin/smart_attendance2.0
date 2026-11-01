import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import type { AttendanceSession } from "@/types";
import type { LedgerRow } from "./attendanceService";
import { escapeHtml, attendanceCsv } from "@/lib/exportFormat";
export { escapeHtml, csvCell, attendanceCsv } from "@/lib/exportFormat";
export async function exportAttendance(
  session: AttendanceSession,
  rows: LedgerRow[],
  format: "csv" | "pdf",
) {
  let uri: string;
  if (format === "csv") {
    uri = `${FS.cacheDirectory}attendance-${session.id.replace(/[^a-zA-Z0-9-]/g, "")}.csv`;
    await FS.writeAsStringAsync(uri, "\uFEFF" + attendanceCsv(rows));
  } else {
    const file = await Print.printToFileAsync({
      html: `<html><head><meta charset="utf-8"><style>body{font:12px Arial;color:#13213b;padding:28px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #dce3ef;padding:10px;text-align:left}</style></head><body><h1>Smart Campus Presence</h1><h2>Attendance report</h2><p>${escapeHtml(session.topic)} · ${escapeHtml(session.date)} · ${escapeHtml(session.lecturerName)}</p><table><tr><th>Registration</th><th>Student</th><th>Status</th><th>Verified</th></tr>${rows.map((r) => `<tr><td>${escapeHtml(r.regNumber)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.verifiedAt)}</td></tr>`).join("")}</table></body></html>`,
    });
    uri = file.uri;
  }
  try {
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("Sharing is unavailable on this device.");
    await Sharing.shareAsync(uri, {
      mimeType: format === "pdf" ? "application/pdf" : "text/csv",
      dialogTitle: "Share attendance report",
    });
  } finally {
    await FS.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}
