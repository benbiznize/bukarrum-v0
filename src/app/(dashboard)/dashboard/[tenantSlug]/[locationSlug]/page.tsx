export default async function LocationDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; locationSlug: string }>;
}) {
  const { tenantSlug, locationSlug } = await params;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Gestión de local</h1>
      <p className="text-muted-foreground">
        {tenantSlug} / {locationSlug}
      </p>
    </main>
  );
}
