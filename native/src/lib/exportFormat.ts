import type { LedgerRow } from "../services/attendanceService";
export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function attendanceCsv(rows: LedgerRow[]) {
  return [
    ["Registration number", "Name", "Status", "Verified at"],
    ...rows.map((r) => [r.regNumber, r.name, r.status, r.verifiedAt ?? ""]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
