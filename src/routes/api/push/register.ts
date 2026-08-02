import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

interface RegistrationBody {
  userId?: string;
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export const Route = createFileRoute("/api/push/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sb = getAdminClient();
        if (!sb) {
          return json({ error: "Push registration is not configured." }, 503);
        }
        const body = (await readBody(request)) as RegistrationBody;
        const { userId, endpoint, keys } = body;
        if (!userId || !endpoint || !keys?.p256dh || !keys?.auth) {
          return json({ error: "userId, endpoint and keys are required." }, 400);
        }
        const { error } = await sb.from("push_subscriptions").upsert(
          {
            user_id: userId,
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
          { onConflict: "endpoint" },
        );
        if (error) {
          return json({ error: "Could not store subscription." }, 500);
        }
        return json({ ok: true });
      },

      DELETE: async ({ request }) => {
        const sb = getAdminClient();
        if (!sb) {
          return json({ error: "Push registration is not configured." }, 503);
        }
        const body = await readBody(request);
        const userId = typeof body.userId === "string" ? body.userId : undefined;
        if (!userId) {
          return json({ error: "userId is required." }, 400);
        }
        const { error } = await sb.from("push_subscriptions").delete().eq("user_id", userId);
        if (error) {
          return json({ error: "Could not remove subscription." }, 500);
        }
        return json({ ok: true });
      },
    },
  },
});
