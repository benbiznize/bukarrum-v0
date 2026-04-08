"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createSubscriptionCheckout,
  changePlan,
} from "@/app/(dashboard)/dashboard/[tenantSlug]/settings/actions";
import { useRouter } from "next/navigation";

interface SubscriptionActionsProps {
  tenantSlug: string;
  currentPlanSlug: string;
  hasMpSubscription: boolean;
  plans: { slug: string; name: string }[];
}

export function SubscriptionActions({
  tenantSlug,
  currentPlanSlug,
  hasMpSubscription,
  plans,
}: SubscriptionActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCheckout(billingCycle: "monthly" | "annual") {
    setError(null);
    setLoading(true);
    const result = await createSubscriptionCheckout(tenantSlug, billingCycle);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.url) {
      window.location.href = result.url;
    }
  }

  async function handleChangePlan(planSlug: string) {
    setError(null);
    setLoading(true);
    const result = await changePlan(tenantSlug, planSlug);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  }

  const otherPlans = plans.filter((p) => p.slug !== currentPlanSlug);

  return (
    <div className="grid gap-3">
      {!hasMpSubscription && (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">Activar pago:</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleCheckout("monthly")}
              disabled={loading}
            >
              {loading ? "Procesando..." : "Pago mensual"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCheckout("annual")}
              disabled={loading}
            >
              {loading ? "Procesando..." : "Pago anual"}
            </Button>
          </div>
        </div>
      )}

      {otherPlans.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">Cambiar plan:</p>
          <div className="flex gap-2">
            {otherPlans.map((plan) => (
              <Button
                key={plan.slug}
                size="sm"
                variant="ghost"
                onClick={() => handleChangePlan(plan.slug)}
                disabled={loading}
              >
                {plan.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
