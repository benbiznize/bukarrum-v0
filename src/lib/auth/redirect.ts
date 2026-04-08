import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Determines where to send a user after authentication.
 * - Has tenant → /dashboard/{slug}
 * - No tenant → /onboarding
 */
export async function resolvePostAuthRedirect(
  supabase: SupabaseClient<Database>
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/login";

  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug")
    .eq("user_id", user.id)
    .single();

  if (tenant) return `/dashboard/${tenant.slug}`;
  return "/onboarding";
}
