"use server";

import { createClient } from "@/lib/supabase/server";
import { MercadoPagoConfig, PreApproval } from "mercadopago";

function getMercadoPago() {
  return new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  });
}

/**
 * Create a MercadoPago PreApproval (subscription) for the tenant's current plan
 * and return the hosted checkout URL.
 */
export async function createSubscriptionCheckout(
  tenantSlug: string,
  billingCycle: "monthly" | "annual"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();

  if (!tenant) return { error: "Tenant no encontrado" };

  // Fetch current subscription + plan
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, plan:plans(name, slug, price_monthly, price_annual)")
    .eq("tenant_id", tenant.id)
    .single();

  if (!subscription?.plan) return { error: "Sin plan activo" };

  const plan = subscription.plan as unknown as {
    name: string;
    slug: string;
    price_monthly: number;
    price_annual: number;
  };

  // Don't create a new preapproval if one already exists
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("mercadopago_subscription_id")
    .eq("tenant_id", tenant.id)
    .single();

  if (existingSub?.mercadopago_subscription_id) {
    return { error: "Ya tienes una suscripción activa en MercadoPago" };
  }

  const amount =
    billingCycle === "annual" ? plan.price_annual : plan.price_monthly;
  const frequency = billingCycle === "annual" ? 12 : 1;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const mp = getMercadoPago();
    const preapproval = await new PreApproval(mp).create({
      body: {
        back_url: `${appUrl}/dashboard/${tenantSlug}/settings/subscription/return`,
        reason: `Bukarrum ${plan.name} — ${billingCycle === "annual" ? "Anual" : "Mensual"}`,
        auto_recurring: {
          frequency,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "CLP",
        },
        payer_email: user.email!,
        status: "pending",
      },
    });

    if (!preapproval.init_point || !preapproval.id) {
      return { error: "No se pudo crear la suscripción. Intenta nuevamente." };
    }

    // Store the preapproval ID so the webhook can match it later
    await supabase
      .from("subscriptions")
      .update({ mercadopago_subscription_id: preapproval.id })
      .eq("id", subscription.id);

    return { url: preapproval.init_point };
  } catch {
    return { error: "Error al conectar con MercadoPago. Intenta nuevamente." };
  }
}

/**
 * Change the tenant's plan. Updates the subscription record.
 * If they have an active MP subscription, they'll need to re-subscribe.
 */
export async function changePlan(tenantSlug: string, newPlanSlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();

  if (!tenant) return { error: "Tenant no encontrado" };

  // Find the new plan
  const { data: newPlan } = await supabase
    .from("plans")
    .select("id")
    .eq("slug", newPlanSlug)
    .single();

  if (!newPlan) return { error: "Plan no encontrado" };

  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan_id: newPlan.id,
      mercadopago_subscription_id: null, // Reset MP link — they need to re-subscribe
    })
    .eq("tenant_id", tenant.id);

  if (error) return { error: "No se pudo cambiar el plan" };

  return { success: true };
}
