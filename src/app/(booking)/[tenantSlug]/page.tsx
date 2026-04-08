import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const supabase = await createClient();

  // Fetch tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("slug", tenantSlug)
    .single();

  if (!tenant) notFound();

  // Check tenant has at least one location with at least one resource assigned
  const { data: readyLocations } = await supabase
    .from("resource_locations")
    .select("location:locations!inner(id, tenant_id)")
    .eq("location.tenant_id", tenant.id)
    .limit(1);

  if (!readyLocations || readyLocations.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">{tenant.name}</h1>
        <p className="text-muted-foreground">
          Esta página de reservas aún no está disponible.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold">Reservar — {tenant.name}</h1>
      <p className="text-muted-foreground">
        Página de reservas próximamente
      </p>
    </main>
  );
}
