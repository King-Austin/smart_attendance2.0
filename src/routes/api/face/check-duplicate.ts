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

const MATCH_THRESHOLD = 0.65;

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

interface SearchRow {
  duplicate?: boolean;
  similarity?: number | null;
  match_id?: string | null;
  match_name?: string | null;
}

export const Route = createFileRoute("/api/face/check-duplicate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sb = getAdminClient();
        if (!sb) {
          return json({ error: "Duplicate face check is not configured." }, 503);
        }
        const body = await readBody(request);
        const vector = body.vector;
        if (!Array.isArray(vector) || vector.length === 0) {
          return json({ error: "vector is required." }, 400);
        }
        const { data, error } = await sb.rpc("check_duplicate_face", {
          p_vector: toVectorLiteral(vector as number[]),
          p_threshold: MATCH_THRESHOLD,
        });
        if (error) {
          return json({ error: "Could not search enrolled faces." }, 500);
        }
        const row = (Array.isArray(data) ? data[0] : data) as SearchRow | undefined;
        return json({
          duplicate: Boolean(row?.duplicate),
          similarity: Number(row?.similarity ?? 0),
          match_id: row?.match_id ?? null,
          match_name: row?.match_name ?? null,
        });
      },
    },
  },
});
