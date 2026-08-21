import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const biometricUrl = Deno.env.get('BIOMETRIC_API_URL');
  const biometricApiKey = Deno.env.get('BIOMETRIC_API_KEY');
  const threshold = Number(Deno.env.get('FACE_DUPLICATE_THRESHOLD') ?? '0.65');
  if (!supabaseUrl || !anonKey || !serviceKey || !biometricUrl) return json({ error: 'Face enrolment is not configured.' }, 503);

  const authorization = request.headers.get('authorization');
  if (!authorization) return json({ error: 'Authentication required.' }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Your session has expired.' }, 401);

  const body = await request.json().catch(() => null) as { image?: unknown; livenessEvidence?: { challengeId?: unknown; frames?: unknown } } | null;
  if (!body || typeof body.image !== 'string' || body.image.length < 1_000 || body.image.length > 2_800_000) {
    return json({ error: 'A valid live-face capture is required.' }, 400);
  }

  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', userData.user.id).maybeSingle();
  if (!profile || profile.role !== 'student') return json({ error: 'A student account is required.' }, 403);

  const challengeId = typeof body.livenessEvidence?.challengeId === 'string' ? body.livenessEvidence.challengeId : '';
  const frames = Array.isArray(body.livenessEvidence?.frames) ? body.livenessEvidence.frames : [];
  const { data: challenge } = await admin.from('liveness_challenges').select('id, instructions, expires_at, used_at').eq('id', challengeId).eq('user_id', userData.user.id).eq('purpose', 'enrolment').maybeSingle();
  const instructions = Array.isArray(challenge?.instructions) ? challenge.instructions : [];
  const frameInstructions = frames.map((frame) => typeof frame === 'object' && frame !== null && 'instruction' in frame ? String(frame.instruction) : '');
  const validFrameImages = frames.every((frame) => typeof frame === 'object' && frame !== null && 'image' in frame && typeof frame.image === 'string' && frame.image.length >= 1_000 && frame.image.length <= 2_800_000);
  if (!challenge || challenge.used_at || new Date(challenge.expires_at).getTime() <= Date.now() || !validFrameImages || JSON.stringify(instructions) !== JSON.stringify(frameInstructions)) {
    return json({ error: 'The liveness challenge is invalid or expired.' }, 409);
  }
  const { data: consumed } = await admin.from('liveness_challenges').update({ used_at: new Date().toISOString() }).eq('id', challenge.id).is('used_at', null).select('id').maybeSingle();
  if (!consumed) return json({ error: 'The liveness challenge was already used.' }, 409);

  let response: Response;
  try {
    response = await fetch(`${biometricUrl.replace(/\/+$/, '')}/enroll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(biometricApiKey ? { 'x-api-key': biometricApiKey } : {}) },
      body: JSON.stringify({ image: body.image, liveness_evidence: { ...body.livenessEvidence, instructions } }),
    });
  } catch {
    return json({ error: 'The biometric service could not be reached.' }, 503);
  }

  const biometric = await response.json().catch(() => ({})) as { vector?: unknown; liveness_passed?: boolean; detail?: unknown };
  if (!response.ok) return json({ error: 'The biometric service rejected this capture.', detail: biometric.detail }, 422);
  if (biometric.liveness_passed !== true) return json({ error: 'Server-confirmed liveness was not established.' }, 403);
  if (!Array.isArray(biometric.vector) || biometric.vector.length !== 512 || !biometric.vector.every(Number.isFinite)) {
    return json({ error: 'The biometric service returned an invalid face embedding.' }, 502);
  }

  const vector = `[${biometric.vector.join(',')}]`;
  const { data, error } = await admin.rpc('enroll_face_atomic', {
    target_student_id: userData.user.id,
    candidate_vector: vector,
    duplicate_threshold: threshold,
  });
  if (error) {
    const duplicate = error.code === '23505' || error.message.toLowerCase().includes('already enrolled');
    return json({ error: duplicate ? 'This face is already enrolled to another account.' : 'Your face could not be enrolled.', code: duplicate ? 'duplicate_face' : 'enrolment_failed' }, duplicate ? 409 : 500);
  }

  return json({ ok: true, enrolment: Array.isArray(data) ? data[0] : data });
});
