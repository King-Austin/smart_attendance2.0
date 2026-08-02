export type Role = "student" | "lecturer";

export interface Course {
  id: string;
  code: string;
  title: string;
  creditUnit: number;
  department: string;
  lecturer: string;
}

export interface StudentProfile {
  id: string;
  role: "student";
  name: string;
  regNumber: string;
  email: string;
  faculty: string;
  department: string;
  level: string;
  semester: string;
  academicSession: string;
  phone?: string;
  courseIds: string[];
  faceEnrolled: boolean;
  /** Server-side InsightFace embedding (512 dims), stored on the profile. */
  faceVector?: number[];
}

export interface LecturerProfile {
  id: string;
  role: "lecturer";
  name: string;
  staffId: string;
  email: string;
  faculty: string;
  department: string;
  courseIds: string[];
}

export type UserProfile = StudentProfile | LecturerProfile;

export type SessionStatus = "active" | "ended" | "scheduled";

export interface AttendanceSession {
  id: string;
  courseId: string;
  topic: string;
  lecturerName: string;
  startTime: string;
  endTime?: string;
  radius: number;
  status: SessionStatus;
  anchor: { lat: number; lng: number; accuracy: number };
  note?: string;
  enrolledCount: number;
  date: string;
}

export type AttendanceStatus = "verified" | "missed" | "failed";

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  courseId: string;
  studentName: string;
  regNumber: string;
  date: string;
  topic: string;
  status: AttendanceStatus;
  faceScore: number | null;
  distance: number | null;
  gpsAccuracy: number | null;
  verifiedAt: string | null;
}

export interface CourseAttendanceSummary {
  courseId: string;
  held: number;
  attended: number;
}
