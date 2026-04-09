import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Box, CalendarDays, DollarSign } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Resumen" };

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();

  if (!tenant) redirect("/onboarding");

  // Fetch stats in parallel
  const [locationsRes, resourcesRes, bookingsRes, revenueRes] =
    await Promise.all([
      supabase
        .from("locations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id),
      supabase
        .from("resources")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id),
      supabase
        .from("bookings")
        .select("id, resource_id!inner(tenant_id)", {
          count: "exact",
          head: true,
        })
        .eq("resource_id.tenant_id", tenant.id)
        .in("status", ["pending", "confirmed"]),
      supabase
        .from("bookings")
        .select("total_price, resource_id!inner(tenant_id)")
        .eq("resource_id.tenant_id", tenant.id)
        .eq("status", "confirmed"),
    ]);

  const totalRevenue = (revenueRes.data ?? []).reduce(
    (sum, b) => sum + b.total_price,
    0
  );

  const formatCLP = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);

  const dict = await getDictionary("es");
  const d = dict.dashboard;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{d.overview}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={d.locations}
          value={String(locationsRes.count ?? 0)}
          icon={MapPin}
        />
        <StatCard
          title={d.resources}
          value={String(resourcesRes.count ?? 0)}
          icon={Box}
        />
        <StatCard
          title={d.activeBookings}
          value={String(bookingsRes.count ?? 0)}
          icon={CalendarDays}
        />
        <StatCard
          title={d.confirmedRevenue}
          value={formatCLP(totalRevenue)}
          icon={DollarSign}
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
