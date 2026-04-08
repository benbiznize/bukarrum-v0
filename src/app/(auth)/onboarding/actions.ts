"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createTenant(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autenticado" };
  }

  const name = (formData.get("name") as string)?.trim();
  const planId = formData.get("planId") as string;

  if (!name || !planId) {
    return { error: "Nombre y plan son requeridos" };
  }

  const slug = slugify(name);
  if (!slug) {
    return { error: "Nombre inválido" };
  }

  // Use service role to bypass RLS for the initial insert
  const serviceClient = createServiceClient();

  // Check if user already has a tenant (one business = one membership)
  const { data: existingTenant } = await serviceClient
    .from("tenants")
    .select("slug")
    .eq("user_id", user.id)
    .single();

  if (existingTenant) {
    redirect(`/dashboard/${existingTenant.slug}`);
  }

  // Insert tenant
  const { data: tenant, error: tenantError } = await serviceClient
    .from("tenants")
    .insert({ user_id: user.id, name, slug })
    .select("id, slug")
    .single();

  if (tenantError) {
    if (tenantError.code === "23505") {
      // Unique constraint violation on slug
      return { error: "Este nombre ya está en uso, intenta otro" };
    }
    return { error: "Algo salió mal. Intenta nuevamente." };
  }

  // Insert subscription with selected plan
  const { error: subError } = await serviceClient
    .from("subscriptions")
    .insert({
      tenant_id: tenant.id,
      plan_id: planId,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });

  if (subError) {
    // Clean up the tenant if subscription insert fails
    await serviceClient.from("tenants").delete().eq("id", tenant.id);
    return { error: "Algo salió mal. Intenta nuevamente." };
  }

  redirect("/onboarding/location");
}
