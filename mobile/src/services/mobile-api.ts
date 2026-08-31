import { supabase } from '@/lib/supabase';
import type { AttendanceRecord, Course, Department, Faculty, LecturerReview, Session } from '@/types/data';

function client() {
  if (!supabase) throw new Error('Live Supabase credentials are not configured.');
  return supabase;
}

function relation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function mapCourse(row: Record<string, any>): Course {
  return { id: row.id, code: row.code, title: row.title, creditUnit: row.credit_unit, departmentId: row.department_id, facultyId: row.faculty_id, level: row.level, semester: row.semester };
}

function mapSession(row: Record<string, any>): Session {
  const course = relation(row.courses) as Record<string, any> | undefined;
  return { id: row.id, courseId: row.course_id, courseCode: course?.code ?? row.course_id, courseTitle: course?.title ?? '', topic: row.topic, lecturerName: row.lecturer_name, lecturerId: row.lecturer_id, startTime: row.start_time, endTime: row.end_time ?? undefined, status: row.status, radius: row.radius, enrolledCount: row.enrolled_count, date: row.date };
}

function mapRecord(row: Record<string, any>): AttendanceRecord {
  const course = relation(row.courses) as Record<string, any> | undefined;
  return { id: row.id, sessionId: row.session_id, courseId: row.course_id, courseCode: course?.code ?? row.course_id, courseTitle: course?.title ?? '', studentId: row.student_id, studentName: row.student_name, regNumber: row.reg_number ?? undefined, topic: row.topic ?? undefined, status: row.status, faceScore: row.face_score ?? undefined, distance: row.distance ?? undefined, gpsAccuracy: row.gps_accuracy ?? undefined, createdAt: row.created_at, correctedAt: row.corrected_at ?? undefined };
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const mobileApi = {
  async faculties(): Promise<Faculty[]> {
    const { data, error } = await client().from('faculties').select('id, code, name').order('name');
    if (error) throw error;
    return (data ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name }));
  },

  async departments(facultyId?: string): Promise<Department[]> {
    let query = client().from('departments').select('id, faculty_id, code, name').order('name');
    if (facultyId) query = query.eq('faculty_id', facultyId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => ({ id: row.id, facultyId: row.faculty_id, code: row.code, name: row.name }));
  },

  async signUp(input: { email: string; password: string; fullName: string; role: 'student' | 'lecturer'; faculty: Faculty; department: Department; regNumber?: string; staffId?: string; level?: string; semester?: string; phone?: string }) {
    const { data, error } = await client().auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { role: input.role, full_name: input.fullName.trim(), faculty_id: input.faculty.id, faculty: input.faculty.name, department_id: input.department.id, department: input.department.name, reg_number: input.regNumber?.trim(), staff_id: input.staffId?.trim(), level: input.level, semester: input.semester, phone: input.phone?.trim() } },
    });
    if (error) throw error;
    return data;
  },

  async enrollFace(image: string, livenessEvidence: Record<string, unknown>) {
    return invoke<{ ok: true }>('enroll-face', { image, livenessEvidence });
  },

  async issueLivenessChallenge(purpose: 'enrolment' | 'attendance') {
    return invoke<{ id: string; instructions: string[]; expiresAt: string }>('liveness-challenge', { purpose });
  },

  async eligibleStudentCourses(profile: { departmentId?: string; level?: string; semester?: string }): Promise<Course[]> {
    if (!profile.departmentId || !profile.level || !profile.semester) return [];
    const { data, error } = await client().from('courses').select('*').eq('department_id', profile.departmentId).eq('level', profile.level).eq('semester', profile.semester).order('code');
    if (error) throw error;
    return (data ?? []).map(mapCourse);
  },

  async studentCourseIds(userId: string): Promise<string[]> {
    const { data, error } = await client().from('student_course_enrollments').select('course_id').eq('student_id', userId);
    if (error) throw error;
    return (data ?? []).map((row) => row.course_id);
  },

  async setStudentCourse(userId: string, courseId: string, selected: boolean) {
    const query = selected
      ? client().from('student_course_enrollments').insert({ student_id: userId, course_id: courseId })
      : client().from('student_course_enrollments').delete().eq('student_id', userId).eq('course_id', courseId);
    const { error } = await query;
    if (error) throw error;
  },

  async activeStudentSessions(courseIds: string[]): Promise<Session[]> {
    if (!courseIds.length) return [];
    const { data, error } = await client().from('attendance_sessions').select('*, courses(code, title)').eq('status', 'active').in('course_id', courseIds).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapSession);
  },

  async session(sessionId: string): Promise<Session> {
    const { data, error } = await client().from('attendance_sessions').select('*, courses(code, title)').eq('id', sessionId).single();
    if (error) throw error;
    return mapSession(data);
  },

  async studentHistory(userId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await client().from('attendance_records').select('*, courses(code, title)').eq('student_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapRecord);
  },

  async lecturerCourses(departmentId: string, lecturerId: string): Promise<{ courses: Course[]; selected: string[] }> {
    const [{ data: courses, error: courseError }, { data: selected, error: selectedError }] = await Promise.all([
      client().from('courses').select('*').eq('department_id', departmentId).order('code'),
      client().from('course_lecturers').select('course_id').eq('lecturer_id', lecturerId),
    ]);
    if (courseError) throw courseError;
    if (selectedError) throw selectedError;
    return { courses: (courses ?? []).map(mapCourse), selected: (selected ?? []).map((row) => row.course_id) };
  },

  async setLecturerCourse(userId: string, courseId: string, selected: boolean) {
    const query = selected
      ? client().from('course_lecturers').insert({ lecturer_id: userId, course_id: courseId })
      : client().from('course_lecturers').delete().eq('lecturer_id', userId).eq('course_id', courseId);
    const { error } = await query;
    if (error) throw error;
  },

  async assignedLecturerCourses(userId: string): Promise<Course[]> {
    const { data: assignments, error } = await client().from('course_lecturers').select('course_id').eq('lecturer_id', userId);
    if (error) throw error;
    const ids = (assignments ?? []).map((row) => row.course_id);
    if (!ids.length) return [];
    const { data, error: courseError } = await client().from('courses').select('*').in('id', ids).order('code');
    if (courseError) throw courseError;
    return (data ?? []).map(mapCourse);
  },

  async lecturerSessions(courseIds: string[]): Promise<Session[]> {
    if (!courseIds.length) return [];
    const { data, error } = await client().from('attendance_sessions').select('*, courses(code, title)').in('course_id', courseIds).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return (data ?? []).map(mapSession);
  },

  async adminSessions(): Promise<Session[]> {
    const { data, error } = await client().from('attendance_sessions').select('*, courses(code, title)').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []).map(mapSession);
  },

  async courseAttendanceSummaries(courseIds: string[]) {
    if (!courseIds.length) return {} as Record<string, { sessions: number; expected: number; verified: number; rate: number }>;
    const { data: sessions, error } = await client().from('attendance_sessions').select('id, course_id, enrolled_count').in('course_id', courseIds).eq('status', 'ended');
    if (error) throw error;
    const sessionIds = (sessions ?? []).map((item) => item.id);
    const { data: records, error: recordError } = sessionIds.length ? await client().from('attendance_records').select('session_id, status').in('session_id', sessionIds) : { data: [], error: null };
    if (recordError) throw recordError;
    const result: Record<string, { sessions: number; expected: number; verified: number; rate: number }> = {};
    for (const courseId of courseIds) {
      const courseSessions = (sessions ?? []).filter((item) => item.course_id === courseId);
      const ids = new Set(courseSessions.map((item) => item.id));
      const expected = courseSessions.reduce((sum, item) => sum + item.enrolled_count, 0);
      const verified = (records ?? []).filter((item) => ids.has(item.session_id) && item.status === 'verified').length;
      result[courseId] = { sessions: courseSessions.length, expected, verified, rate: expected ? Math.round((verified / expected) * 100) : 0 };
    }
    return result;
  },

  async sessionRecords(sessionId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await client().from('attendance_records').select('*, courses(code, title)').eq('session_id', sessionId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapRecord);
  },

  async createSession(input: { courseId: string; topic: string; latitude: number; longitude: number; accuracy: number }) {
    return invoke<{ ok: true; session: Record<string, unknown> }>('session-actions', { action: 'create_session', ...input });
  },

  async endSession(sessionId: string) {
    return invoke<{ ok: true }>('session-actions', { action: 'end_session', sessionId });
  },

  async correctAttendance(recordId: string, status: AttendanceRecord['status'], reason: string) {
    const { data, error } = await client().rpc('correct_attendance_record', { target_record_id: recordId, next_status: status, correction_reason: reason });
    if (error) throw error;
    return data;
  },

  async pendingLecturers(): Promise<LecturerReview[]> {
    const { data, error } = await client().from('profiles').select('id, name, email, staff_id, department, approval_status').eq('role', 'lecturer').eq('approval_status', 'pending').order('created_at');
    if (error) throw error;
    return (data ?? []).map((row) => ({ id: row.id, name: row.name, email: row.email, staffId: row.staff_id ?? undefined, department: row.department ?? '', approvalStatus: row.approval_status }));
  },

  async reviewLecturer(lecturerId: string, decision: 'approved' | 'rejected') {
    return invoke<{ ok: true }>('session-actions', { action: 'review_lecturer', lecturerId, decision });
  },

  async adminOverview() {
    const [departments, courses, pending, sessions, records] = await Promise.all([
      client().from('departments').select('*', { count: 'exact', head: true }),
      client().from('courses').select('*', { count: 'exact', head: true }),
      client().from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'lecturer').eq('approval_status', 'pending'),
      client().from('attendance_sessions').select('*', { count: 'exact', head: true }).eq('date', new Date().toISOString().slice(0, 10)),
      client().from('attendance_records').select('status').gte('created_at', new Date().toISOString().slice(0, 10)),
    ]);
    const rows = records.data ?? [];
    const rate = rows.length ? Math.round((rows.filter((row) => row.status === 'verified').length / rows.length) * 100) : 0;
    return { departments: departments.count ?? 0, courses: courses.count ?? 0, pending: pending.count ?? 0, sessions: sessions.count ?? 0, attendanceRate: rate };
  },

  async createDepartment(input: { facultyId: string; name: string; code: string; createdBy: string }) {
    const { error } = await client().from('departments').insert({ faculty_id: input.facultyId, name: input.name.trim(), code: input.code.trim().toUpperCase(), created_by: input.createdBy });
    if (error) throw error;
  },

  async createCourse(input: { id: string; code: string; title: string; creditUnit: number; facultyId: string; departmentId: string; departmentName: string; level: string; semester: string }) {
    const { error } = await client().from('courses').insert({ id: input.id, code: input.code.trim().toUpperCase(), title: input.title.trim(), credit_unit: input.creditUnit, faculty_id: input.facultyId, department_id: input.departmentId, department: input.departmentName, level: input.level, semester: input.semester });
    if (error) throw error;
  },
};
