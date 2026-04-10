import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/booking-flow";
import { getResourcesForLocation } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;
  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("slug", tenantSlug)
    .single();

  return {
    title: tenant ? `Reservar en ${tenant.name} — Bukarrum` : "Reservar — Bukarrum",
    description: tenant ? `Reserva tu espacio en ${tenant.name}` : undefined,
  };
}

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

  // Prefetch resources when there's only one location so StepResource can
  // hydrate without a client-side round-trip (the first resource image is
  // the LCP element in that flow).
  const initialResources =
    readyLocations.length === 1
      ? await getResourcesForLocation(readyLocations[0].id)
      : null;

  return (
    <main className="min-h-screen">
      <BookingFlow
        tenantId={tenant.id}
        tenantName={tenant.name}
        locations={readyLocations}
        initialResources={initialResources}
      />
    </main>
  );
}
