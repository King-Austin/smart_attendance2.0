import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
}

export const Route = createFileRoute("/api/admin/users/$userId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          return json({ error: "Account deletion is not configured." }, 503);
        }

        const token = getBearerToken(request);
        if (!token) return json({ error: "Authentication is required." }, 401);

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData.user) {
          return json({ error: "The authenticated session is invalid." }, 401);
        }

        const { data: caller } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .maybeSingle();
        if (caller?.role !== "admin") {
          return json({ error: "Administrator access is required." }, 403);
        }

        const { data: target, error: targetError } = await supabase
          .from("profiles")
          .select("id, role, course_ids")
          .eq("id", params.userId)
          .maybeSingle();
        if (targetError) return json({ error: "Could not inspect the account." }, 500);
        if (!target) return json({ error: "Account not found." }, 404);
        if (target.role === "admin") {
          return json({ error: "Administrator accounts cannot be deleted here." }, 400);
        }

        if (target.role === "lecturer") {
          const { count, error: sessionError } = await supabase
            .from("attendance_sessions")
            .select("id", { count: "exact", head: true })
            .eq("lecturer_id", target.id);
          if (sessionError) return json({ error: "Could not inspect lecturer sessions." }, 500);
          if ((target.course_ids?.length ?? 0) > 0 || (count ?? 0) > 0) {
            return json(
              {
                error:
                  "Remove or reassign this lecturer's courses and attendance sessions before deleting the account.",
              },
              409,
            );
          }
        }

        const { error: deleteError } = await supabase.auth.admin.deleteUser(target.id);
        if (deleteError) return json({ error: "Could not delete the account." }, 500);

        return json({ ok: true });
      },
    },
  },
});
