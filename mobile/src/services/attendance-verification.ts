import { supabase } from '@/lib/supabase';

export type AttendanceVerificationResult =
  | { ok: true; faceScore: number; distance: number; gpsAccuracy: number; record: unknown }
  | { ok: false; code: string; message: string };

export interface AttendanceVerificationPayload {
  sessionId: string;
  image: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    capturedAt: string;
  };
  livenessEvidence: Record<string, unknown>;
}

export async function verifyAttendance(payload: AttendanceVerificationPayload): Promise<AttendanceVerificationResult> {
  if (!supabase) return { ok: false, code: 'not_configured', message: 'Live Supabase credentials are not configured.' };
  const { data, error } = await supabase.functions.invoke<AttendanceVerificationResult>('verify-attendance', { body: payload });
  if (error) return { ok: false, code: 'network_error', message: error.message || 'Attendance verification could not be reached.' };
  return data ?? { ok: false, code: 'empty_response', message: 'The verification server returned no result.' };
}
