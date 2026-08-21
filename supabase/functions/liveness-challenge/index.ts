import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } }); }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json({ error: 'Server is not configured.' }, 503);
  const authorization = request.headers.get('authorization'); if (!authorization) return json({ error: 'Authentication required.' }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data } = await userClient.auth.getUser(); if (!data.user) return json({ error: 'Your session has expired.' }, 401);
  const body = await request.json().catch(() => ({})) as { purpose?: string };
  const purpose = body.purpose === 'attendance' ? 'attendance' : body.purpose === 'enrolment' ? 'enrolment' : null;
  if (!purpose) return json({ error: 'Challenge purpose is required.' }, 400);
  const random = new Uint8Array(1); crypto.getRandomValues(random);
  const instructions = random[0] % 2 === 0
    ? ['Look straight', 'Turn your head left', 'Turn your head right', 'Close both eyes']
    : ['Look straight', 'Turn your head right', 'Turn your head left', 'Close both eyes'];
  const { data: challenge, error } = await admin.from('liveness_challenges').insert({ user_id: data.user.id, purpose, instructions }).select('id, instructions, expires_at').single();
  if (error) return json({ error: 'A liveness challenge could not be issued.' }, 500);
  return json({ id: challenge.id, instructions: challenge.instructions, expiresAt: challenge.expires_at });
});
