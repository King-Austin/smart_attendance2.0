export interface Faculty { id: string; code: string; name: string }
export interface Department { id: string; facultyId: string; code: string; name: string }
export interface Course { id: string; code: string; title: string; creditUnit: number; departmentId: string; facultyId: string; level: string; semester: string }
export interface Session { id: string; courseId: string; courseCode: string; courseTitle: string; topic: string; lecturerName: string; lecturerId: string; startTime: string; endTime?: string; status: 'active' | 'ended' | 'scheduled'; radius: number; enrolledCount: number; date: string }
export interface AttendanceRecord { id: string; sessionId: string; courseId: string; courseCode: string; courseTitle: string; studentId: string; studentName: string; regNumber?: string; topic?: string; status: 'verified' | 'missed' | 'failed'; faceScore?: number; distance?: number; gpsAccuracy?: number; createdAt: string; correctedAt?: string }
export interface LecturerReview { id: string; name: string; email: string; staffId?: string; department: string; approvalStatus: 'pending' | 'approved' | 'rejected' }
