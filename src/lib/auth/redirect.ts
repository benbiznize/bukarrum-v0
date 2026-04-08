import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Determines where to send a user after authentication.
 * Walks the onboarding funnel: tenant → location → resource → dashboard.
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
    .select("id, slug")
    .eq("user_id", user.id)
    .single();

  if (!tenant) return "/onboarding";

  // Check if tenant has at least one location
  const { count: locationCount } = await supabase
    .from("locations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);

  if (!locationCount || locationCount === 0) return "/onboarding/location";

  // Check if tenant has at least one resource assigned to a location
  const { count: resourceCount } = await supabase
    .from("resources")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);

  if (!resourceCount || resourceCount === 0) return "/onboarding/resource";

  return `/dashboard/${tenant.slug}`;
}
