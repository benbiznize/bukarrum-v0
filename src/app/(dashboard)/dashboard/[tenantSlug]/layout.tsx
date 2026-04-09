import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { getPlanFeatures } from "@/lib/plans/check-limit";

export default async function TenantDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch tenant with subscription + plan
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, user_id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();

  if (!tenant) redirect("/onboarding");

  // Fetch locations and plan features in parallel
  const [{ data: locations }, plan] = await Promise.all([
    supabase
      .from("locations")
      .select("id, name, slug, is_active")
      .eq("tenant_id", tenant.id)
      .order("name"),
    getPlanFeatures(tenant.id),
  ]);

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar
        tenant={tenant}
        locations={locations ?? []}
        tenantSlug={tenantSlug}
        analyticsEnabled={plan?.features.analytics ?? false}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
