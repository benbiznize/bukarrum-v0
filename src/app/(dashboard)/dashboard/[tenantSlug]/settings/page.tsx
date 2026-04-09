import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";

export const metadata: Metadata = { title: "Configuración" };
import { Badge } from "@/components/ui/badge";
import { SubscriptionActions } from "@/components/dashboard/subscription-actions";

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
    .select(
      "status, mercadopago_subscription_id, current_period_end, plan:plans(name, slug, price_monthly, price_annual)"
    )
    .eq("tenant_id", tenant.id)
    .single();

  const plan = subscription?.plan as unknown as {
    name: string;
    slug: string;
    price_monthly: number;
    price_annual: number;
  } | null;

  const { data: allPlans } = await supabase
    .from("plans")
    .select("slug, name")
    .order("price_monthly");

  const formatCLP = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const d = dict.dashboard;
  const statusLabels = d.subscriptionStatusLabels as Record<string, string>;

  const hasMpSubscription = !!subscription?.mercadopago_subscription_id;
  const trialEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const isTrialing =
    subscription?.status === "active" && !hasMpSubscription && trialEnd;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{d.settings}</h1>

      <div className="grid gap-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>{d.business}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{dict.common.name}</span>
              <span>{tenant.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{d.publicUrl}</span>
              <span>bukarrum.com/{tenant.slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{d.emailLabel}</span>
              <span>{user.email}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{d.subscription}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {plan ? (
              <>
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{d.plan}</span>
                    <span className="font-medium">{plan.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{d.price}</span>
                    <span>{formatCLP(plan.price_monthly)}{dict.common.perMonth}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{dict.common.status}</span>
                    <Badge
                      variant={
                        subscription?.status === "active"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {statusLabels[subscription?.status ?? ""] ??
                        subscription?.status}
                    </Badge>
                  </div>
                  {isTrialing && trialEnd && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        {d.trialUntil}
                      </span>
                      <span>
                        {trialEnd.toLocaleDateString("es-CL", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  {hasMpSubscription && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{d.payment}</span>
                      <span className="text-green-500 text-xs font-medium">
                        {d.mercadoPagoActive}
                      </span>
                    </div>
                  )}
                </div>

                <SubscriptionActions
                  tenantSlug={tenantSlug}
                  currentPlanSlug={plan.slug}
                  hasMpSubscription={hasMpSubscription}
                  plans={(allPlans ?? []).map((p) => ({
                    slug: p.slug,
                    name: p.name,
                  }))}
                />
              </>
            ) : (
              <p className="text-muted-foreground">{d.noActiveSubscription}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
