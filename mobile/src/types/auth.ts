export type Role = 'student' | 'lecturer' | 'admin';

export interface AppProfile {
  id: string;
  role: Role;
  name: string;
  email: string;
  faculty: string;
  department: string;
  level?: string;
  semester?: string;
  regNumber?: string;
  staffId?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  faceEnrolled?: boolean;
  courseIds: string[];
}
