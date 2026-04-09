import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/booking-flow";

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

  // Fetch active locations that have at least one active resource assigned
  const { data: locationRows } = await supabase
    .from("locations")
    .select("id, name, address, city, timezone, image_url")
    .eq("tenant_id", tenant.id)
    .eq("is_active", true)
    .order("name");

  const locations = locationRows ?? [];

  // Filter to locations that have at least one resource
  const { data: rlRows } = await supabase
    .from("resource_locations")
    .select("location_id")
    .in(
      "location_id",
      locations.map((l) => l.id)
    );

  const locationsWithResources = new Set(
    (rlRows ?? []).map((r) => r.location_id)
  );

  const readyLocations = locations.filter((l) =>
    locationsWithResources.has(l.id)
  );

  if (readyLocations.length === 0) {
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
    <main className="min-h-screen">
      <BookingFlow
        tenantId={tenant.id}
        tenantName={tenant.name}
        locations={readyLocations}
      />
    </main>
  );
}
