"use server";

import { createClient } from "@/lib/supabase/server";
import type { PlanFeatures } from "@/lib/types/plan-features";

export type PlanLimitResult =
  | { allowed: true; current: number; limit: number; plan: string }
  | { allowed: false; current: number; limit: number; plan: string; error: string };

/**
 * Resolve the tenant's active plan features.
 * Returns null if the tenant has no active subscription.
 */
export async function getPlanFeatures(tenantId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("subscriptions")
    .select("plan:plans(slug, name, features)")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .single();

  if (!data?.plan) return null;

  const plan = data.plan as unknown as {
    slug: string;
    name: string;
    features: PlanFeatures;
  };

  return plan;
}

/**
 * Check whether the tenant can create a new location.
 */
export async function checkLocationLimit(
  tenantId: string
): Promise<PlanLimitResult> {
  const plan = await getPlanFeatures(tenantId);
  if (!plan) {
    return { allowed: false, current: 0, limit: 0, plan: "none", error: "No tienes un plan activo" };
  }

  const limit = plan.features.locations;
  if (limit === -1) {
    return { allowed: true, current: 0, limit: -1, plan: plan.name };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("locations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const current = count ?? 0;

  if (current >= limit) {
    return {
      allowed: false,
      current,
      limit,
      plan: plan.name,
      error: `Tu plan ${plan.name} permite hasta ${limit} ${limit === 1 ? "ubicación" : "ubicaciones"}`,
    };
  }

  return { allowed: true, current, limit, plan: plan.name };
}

/**
 * Check whether the tenant can create a new resource at a given location.
 */
export async function checkResourceLimit(
  tenantId: string,
  locationId: string
): Promise<PlanLimitResult> {
  const plan = await getPlanFeatures(tenantId);
  if (!plan) {
    return { allowed: false, current: 0, limit: 0, plan: "none", error: "No tienes un plan activo" };
  }

  const limit = plan.features.resources_per_location;
  if (limit === -1) {
    return { allowed: true, current: 0, limit: -1, plan: plan.name };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("resource_locations")
    .select("id", { count: "exact", head: true })
    .eq("location_id", locationId);

  const current = count ?? 0;

  if (current >= limit) {
    return {
      allowed: false,
      current,
      limit,
      plan: plan.name,
      error: `Tu plan ${plan.name} permite hasta ${limit} recursos por ubicación`,
    };
  }

  return { allowed: true, current, limit, plan: plan.name };
}
