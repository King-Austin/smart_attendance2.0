import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LocationPayload = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

type VerificationBody = {
  sessionId?: string;
  image?: string;
  location?: LocationPayload;
  livenessEvidence?: Record<string, unknown>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthRadius = 6_371_000;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function parseVector(value: unknown): number[] | null {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number) : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const biometricUrl = Deno.env.get('BIOMETRIC_API_URL');
  const biometricApiKey = Deno.env.get('BIOMETRIC_API_KEY');
  const requireServerLiveness = Deno.env.get('REQUIRE_SERVER_LIVENESS') !== 'false';

  if (!supabaseUrl || !anonKey || !serviceKey || !biometricUrl) {
    return json({ error: 'Attendance verification is not configured.' }, 503);
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) return json({ error: 'Authentication required.' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData.user;
  if (userError || !user) return json({ error: 'Your session has expired.' }, 401);

  let body: VerificationBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const { sessionId, image, location, livenessEvidence } = body;
  const audit = async (outcome: string, values: { score?: number; distance?: number; accuracy?: number; capturedAt?: string; metadata?: Record<string, unknown> } = {}) => {
    await admin.from('attendance_verification_attempts').insert({
      session_id: sessionId ?? null,
      student_id: user.id,
      outcome,
      face_score: values.score ?? null,
      distance_meters: values.distance ?? null,
      gps_accuracy: values.accuracy ?? null,
      location_captured_at: values.capturedAt ?? null,
      metadata: values.metadata ?? {},
    });
  };
  const fail = async (code: string, message: string, status: number, values?: Parameters<typeof audit>[1]) => {
    await audit(code, values);
    return json({ ok: false, code, message }, status);
  };

  if (!sessionId || !image || !location) return fail('invalid_payload', 'Session, face image and precise location are required.', 400);
  if (image.length > 2_800_000) return fail('image_too_large', 'The face capture is too large. Capture again.', 413);
  if (![location.latitude, location.longitude, location.accuracy].every(Number.isFinite)) return fail('invalid_location', 'The location reading is invalid.', 400);

  const locationAge = Date.now() - new Date(location.capturedAt).getTime();
  if (!Number.isFinite(locationAge) || locationAge < -5_000 || locationAge > 30_000) {
    return fail('stale_location', 'Your location reading expired. Acquire a new precise reading.', 400, { accuracy: location.accuracy, capturedAt: location.capturedAt });
  }
  if (location.accuracy > 25) {
    return fail('poor_accuracy', 'GPS accuracy must be 25 metres or better.', 400, { accuracy: location.accuracy, capturedAt: location.capturedAt });
  }

  const [{ data: session }, { data: profile }] = await Promise.all([
    admin.from('attendance_sessions').select('*').eq('id', sessionId).eq('status', 'active').maybeSingle(),
    admin.from('profiles').select('id, role, name, reg_number, face_enrolled, face_vector, course_ids').eq('id', user.id).maybeSingle(),
  ]);
  if (!session) return fail('session_closed', 'This attendance session is no longer active.', 409);
  if (!profile || profile.role !== 'student') return fail('student_required', 'A student account is required.', 403);

  const { data: normalizedEnrollment } = await admin.from('student_course_enrollments').select('course_id').eq('student_id', user.id).eq('course_id', session.course_id).maybeSingle();
  const legacyCourseIds = Array.isArray(profile.course_ids) ? profile.course_ids : [];
  if (!normalizedEnrollment && !legacyCourseIds.includes(session.course_id)) {
    return fail('not_enrolled', 'You are not enrolled in this course.', 403);
  }

  const distance = haversineMeters(
    { latitude: location.latitude, longitude: location.longitude },
    { latitude: Number(session.anchor_lat), longitude: Number(session.anchor_lng) },
  );
  if (distance > 150) return fail('outside_geofence', `You are ${distance} metres from the lecture anchor.`, 403, { distance, accuracy: location.accuracy, capturedAt: location.capturedAt });

  const storedVector = parseVector(profile.face_vector);
  if (!profile.face_enrolled || !storedVector?.length) return fail('face_not_enrolled', 'Complete face enrolment before checking in.', 409, { distance, accuracy: location.accuracy });

  let biometricResponse: Response;
  try {
    biometricResponse = await fetch(`${biometricUrl.replace(/\/+$/, '')}/verify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(biometricApiKey ? { 'x-api-key': biometricApiKey } : {}),
      },
      body: JSON.stringify({ image, stored_vector: storedVector, liveness_evidence: livenessEvidence ?? {} }),
    });
  } catch {
    return fail('biometric_unavailable', 'The biometric service could not be reached. Try again.', 503, { distance, accuracy: location.accuracy });
  }

  const biometric = await biometricResponse.json().catch(() => ({})) as { match?: boolean; similarity?: number; liveness_passed?: boolean; detail?: unknown };
  if (!biometricResponse.ok) return fail('biometric_rejected', 'The biometric service rejected the capture.', 422, { distance, accuracy: location.accuracy, metadata: { detail: biometric.detail } });
  if (!biometric.match) return fail('face_mismatch', 'Your live face did not match the enrolled identity.', 403, { score: biometric.similarity, distance, accuracy: location.accuracy });
  if (requireServerLiveness && biometric.liveness_passed !== true) return fail('liveness_failed', 'Server-confirmed liveness was not established.', 403, { score: biometric.similarity, distance, accuracy: location.accuracy });

  const { data: record, error: recordError } = await admin.rpc('record_server_verified_attendance', {
    target_session_id: sessionId,
    target_student_id: user.id,
    verified_face_score: biometric.similarity ?? 0,
    verified_distance: distance,
    verified_gps_accuracy: location.accuracy,
  });
  if (recordError) {
    const duplicate = recordError.code === '23505';
    return fail(duplicate ? 'already_recorded' : 'record_failed', duplicate ? 'Attendance has already been recorded for this session.' : 'Attendance could not be recorded.', duplicate ? 409 : 500, { score: biometric.similarity, distance, accuracy: location.accuracy });
  }

  await audit('verified', { score: biometric.similarity, distance, accuracy: location.accuracy, capturedAt: location.capturedAt });
  return json({ ok: true, record, faceScore: biometric.similarity ?? 0, distance, gpsAccuracy: location.accuracy });
});
