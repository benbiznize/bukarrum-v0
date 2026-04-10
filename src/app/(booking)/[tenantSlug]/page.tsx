import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/booking-flow";
import { getBookingPageData } from "@/lib/booking/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;
  const data = await getBookingPageData(tenantSlug);

  return {
    title: data
      ? `Reservar en ${data.tenant.name} — Bukarrum`
      : "Reservar — Bukarrum",
    description: data ? `Reserva tu espacio en ${data.tenant.name}` : undefined,
  };
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const data = await getBookingPageData(tenantSlug);

  if (!data) notFound();

  const { tenant, readyLocations, initialResources } = data;

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
        initialResources={initialResources}
      />
    </main>
  );
}
