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

const MATCH_THRESHOLD = Number(process.env.FACE_DUPLICATE_THRESHOLD ?? 0.65);

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
        let excludeProfileId =
          typeof body.excludeProfileId === "string" ? body.excludeProfileId : null;
        if (
          !Array.isArray(vector) ||
          vector.length !== 512 ||
          !vector.every((value) => typeof value === "number" && Number.isFinite(value))
        ) {
          return json({ error: "A valid 512-value face vector is required." }, 400);
        }

        if (excludeProfileId) {
          const authorization = request.headers.get("authorization") ?? "";
          const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
          if (!token) {
            return json({ error: "Authentication is required for face re-enrollment." }, 401);
          }
          const { data: authData, error: authError } = await sb.auth.getUser(token);
          if (authError || !authData.user) {
            return json({ error: "The authenticated session could not be verified." }, 401);
          }
          if (authData.user.id !== excludeProfileId) {
            return json({ error: "A profile may exclude only its own current enrollment." }, 403);
          }
          excludeProfileId = authData.user.id;
        }
        const { data, error } = await sb.rpc("check_duplicate_face", {
          p_vector: toVectorLiteral(vector as number[]),
          p_threshold: MATCH_THRESHOLD,
          p_exclude_id: excludeProfileId,
        });
        if (error) {
          return json({ error: "Could not search enrolled faces." }, 500);
        }
        const row = (Array.isArray(data) ? data[0] : data) as SearchRow | undefined;
        // Secure: Never leak match_id or match_name to the client
        return json({
          duplicate: Boolean(row?.duplicate),
          similarity: Number(row?.similarity ?? 0),
        });
      },
    },
  },
});
