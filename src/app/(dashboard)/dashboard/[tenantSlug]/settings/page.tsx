import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage({
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
    .select("id, name, slug")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();

  if (!tenant) redirect("/onboarding");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, plan:plans(name, price_monthly)")
    .eq("tenant_id", tenant.id)
    .single();

  const plan = subscription?.plan as unknown as {
    name: string;
    price_monthly: number;
  } | null;

  const formatCLP = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>

      <div className="grid gap-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Negocio</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nombre</span>
              <span>{tenant.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">URL pública</span>
              <span>bukarrum.com/{tenant.slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Correo</span>
              <span>{user.email}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suscripción</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {plan ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium capitalize">{plan.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Precio</span>
                  <span>{formatCLP(plan.price_monthly)}/mes</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Estado</span>
                  <Badge
                    variant={
                      subscription?.status === "active" ? "default" : "secondary"
                    }
                  >
                    {subscription?.status === "active" ? "Activa" : subscription?.status}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Sin suscripción activa</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
