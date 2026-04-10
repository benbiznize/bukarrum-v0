"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";
import { checkResourceLimit } from "@/lib/plans/check-limit";
import { revalidateBookingPage } from "@/lib/booking/queries";

type ResourceType = Database["public"]["Enums"]["resource_type"];

export async function createResource(
  tenantSlug: string,
  locationSlug: string,
  locationId: string,
  formData: FormData
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

  // Check plan limit before creating
  const limitCheck = await checkResourceLimit(tenant.id, locationId);
  if (!limitCheck.allowed) return { error: limitCheck.error };

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const type = (formData.get("type") as ResourceType) || "room";
  const hourlyRate = parseInt(formData.get("hourly_rate") as string, 10);
  const minDuration = parseInt(formData.get("min_duration_hours") as string, 10) || 1;
  const maxDuration = parseInt(formData.get("max_duration_hours") as string, 10) || 8;

  if (!name) return { error: "El nombre es requerido" };
  if (isNaN(hourlyRate) || hourlyRate <= 0) return { error: "Tarifa inválida" };

  const imageUrl = (formData.get("image_url") as string)?.trim() || null;

  // Create the resource (tenant-scoped)
  const { data: resource, error } = await supabase
    .from("resources")
    .insert({
      tenant_id: tenant.id,
      name,
      description,
      type,
      hourly_rate: hourlyRate,
      min_duration_hours: minDuration,
      max_duration_hours: maxDuration,
      image_url: imageUrl,
    })
    .select("id")
    .single();

  if (error || !resource) {
    return { error: "Algo salió mal. Intenta nuevamente." };
  }

  // Assign resource to the current location
  await supabase.from("resource_locations").insert({
    resource_id: resource.id,
    location_id: locationId,
  });

  revalidatePath(`/dashboard/${tenantSlug}/${locationSlug}`);
  revalidateBookingPage(tenantSlug);
  redirect(`/dashboard/${tenantSlug}/${locationSlug}`);
}

export async function updateResource(
  tenantSlug: string,
  locationSlug: string,
  resourceId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const type = (formData.get("type") as ResourceType) || "room";
  const hourlyRate = parseInt(formData.get("hourly_rate") as string, 10);
  const minDuration = parseInt(formData.get("min_duration_hours") as string, 10) || 1;
  const maxDuration = parseInt(formData.get("max_duration_hours") as string, 10) || 8;
  const isActive = formData.get("is_active") === "on";

  if (!name) return { error: "El nombre es requerido" };
  if (isNaN(hourlyRate) || hourlyRate <= 0) return { error: "Tarifa inválida" };

  const imageUrl = (formData.get("image_url") as string)?.trim() || null;

  const { error } = await supabase
    .from("resources")
    .update({
      name,
      description,
      type,
      hourly_rate: hourlyRate,
      min_duration_hours: minDuration,
      max_duration_hours: maxDuration,
      is_active: isActive,
      image_url: imageUrl,
    })
    .eq("id", resourceId);

  if (error) {
    return { error: "Algo salió mal. Intenta nuevamente." };
  }

  revalidatePath(`/dashboard/${tenantSlug}/${locationSlug}`);
  revalidateBookingPage(tenantSlug);
  redirect(`/dashboard/${tenantSlug}/${locationSlug}`);
}
