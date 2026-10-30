import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

async function sendPush(admin: ReturnType<typeof createClient>, userIds: string[], title: string, body: string, data: Record<string, unknown>) {
  if (!userIds.length) return;
  const { data: tokens } = await admin.from('device_push_tokens').select('expo_push_token').in('user_id', userIds).eq('enabled', true);
  const messages = (tokens ?? []).map((item) => ({ to: item.expo_push_token, sound: 'default', title, body, data }));
  if (!messages.length) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'accept-encoding': 'gzip, deflate' },
    body: JSON.stringify(messages),
  }).catch(() => undefined);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Server is not configured.' }, 503);
  const authorization = request.headers.get('authorization');
  if (!authorization) return json({ error: 'Authentication required.' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData.user;
  if (userError || !user) return json({ error: 'Your session has expired.' }, 401);
  const { data: profile } = await admin.from('profiles').select('id, role, name, approval_status').eq('id', user.id).maybeSingle();
  if (!profile) return json({ error: 'Profile not found.' }, 403);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action;

  if (action === 'create_session') {
    if (profile.role !== 'lecturer' || profile.approval_status !== 'approved') return json({ error: 'An approved lecturer account is required.' }, 403);
    const courseId = typeof body?.courseId === 'string' ? body.courseId : '';
    const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    const accuracy = Number(body?.accuracy);
    if (!courseId || topic.length < 3 || ![latitude, longitude, accuracy].every(Number.isFinite)) return json({ error: 'Course, topic, and precise location are required.' }, 400);
    if (accuracy > 25) return json({ error: 'Anchor GPS accuracy must be 25 metres or better.' }, 400);
    const { data: assignment } = await admin.from('course_lecturers').select('course_id').eq('lecturer_id', user.id).eq('course_id', courseId).maybeSingle();
    if (!assignment) return json({ error: 'You are not assigned to this course.' }, 403);
    const { data: course } = await admin.from('courses').select('id, code, title').eq('id', courseId).single();
    const { count } = await admin.from('student_course_enrollments').select('*', { count: 'exact', head: true }).eq('course_id', courseId);
    const now = new Date();
    const session = {
      id: crypto.randomUUID(), course_id: courseId, topic, lecturer_name: profile.name, lecturer_id: user.id,
      start_time: now.toISOString(), radius: 150, status: 'active', anchor_lat: latitude,
      anchor_lng: longitude, anchor_accuracy: accuracy, enrolled_count: count ?? 0,
      date: now.toISOString().slice(0, 10),
    };
    const { data: created, error } = await admin.from('attendance_sessions').insert(session).select('*').single();
    if (error) return json({ error: error.message }, 400);
    const { data: enrollments } = await admin.from('student_course_enrollments').select('student_id').eq('course_id', courseId);
    await sendPush(admin, (enrollments ?? []).map((item) => item.student_id), 'Attendance is open', `${course.code} · ${topic}`, { type: 'session_opened', sessionId: created.id });
    return json({ ok: true, session: created });
  }

  if (action === 'end_session') {
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    const { data: session } = await admin.from('attendance_sessions').select('id, lecturer_id, status, course_id, date, topic').eq('id', sessionId).maybeSingle();
    if (!session) return json({ error: 'Session not found.' }, 404);
    if (session.lecturer_id !== user.id) return json({ error: 'Only the lecturer who opened this session can end it.' }, 403);
    const [{ data: enrollments }, { data: existing }] = await Promise.all([
      admin.from('student_course_enrollments').select('student_id').eq('course_id', session.course_id),
      admin.from('attendance_records').select('student_id').eq('session_id', session.id),
    ]);
    const recorded = new Set((existing ?? []).map((item) => item.student_id));
    const missingIds = (enrollments ?? []).map((item) => item.student_id).filter((id) => !recorded.has(id));
    if (missingIds.length) {
      const { data: students } = await admin.from('profiles').select('id, name, reg_number').in('id', missingIds);
      const missed = (students ?? []).map((student) => ({ session_id: session.id, course_id: session.course_id, student_id: student.id, student_name: student.name, reg_number: student.reg_number, date: session.date, topic: session.topic, status: 'missed' }));
      if (missed.length) await admin.from('attendance_records').upsert(missed, { onConflict: 'session_id,student_id', ignoreDuplicates: true });
    }
    const { data: ended, error } = await admin.from('attendance_sessions').update({ status: 'ended', end_time: new Date().toISOString() }).eq('id', sessionId).eq('status', 'active').select('*').single();
    if (error) return json({ error: 'The session could not be ended.' }, 409);
    return json({ ok: true, session: ended });
  }

  if (action === 'review_lecturer') {
    if (profile.role !== 'admin') return json({ error: 'Administrator access is required.' }, 403);
    const lecturerId = typeof body?.lecturerId === 'string' ? body.lecturerId : '';
    const decision = body?.decision === 'approved' ? 'approved' : body?.decision === 'rejected' ? 'rejected' : null;
    if (!lecturerId || !decision) return json({ error: 'Lecturer and decision are required.' }, 400);
    const { data: lecturer, error } = await admin.from('profiles').update({ approval_status: decision }).eq('id', lecturerId).eq('role', 'lecturer').select('id, name').single();
    if (error) return json({ error: 'Lecturer review could not be saved.' }, 400);
    await sendPush(admin, [lecturerId], decision === 'approved' ? 'Lecturer account approved' : 'Lecturer application reviewed', decision === 'approved' ? 'You may now select department courses.' : 'Your lecturer account was not approved.', { type: 'lecturer_reviewed', decision });
    return json({ ok: true, lecturer });
  }

  return json({ error: 'Unknown action.' }, 400);
});
