export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Panel de administración</h1>
      <p className="text-muted-foreground">Tenant: {tenantSlug}</p>
    </main>
  );
}
