import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  return (
    <main className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <SignOutButton />
      </div>
      <p className="text-muted-foreground">Tenant: {tenantSlug}</p>
    </main>
  );
}
