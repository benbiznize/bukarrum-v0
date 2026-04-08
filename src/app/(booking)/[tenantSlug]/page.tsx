export default async function BookingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold">Reservar</h1>
      <p className="text-muted-foreground">Estudio: {tenantSlug}</p>
    </main>
  );
}
