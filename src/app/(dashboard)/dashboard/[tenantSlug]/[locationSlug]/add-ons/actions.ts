"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createAddOn(
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

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const hourlyRate = parseInt(formData.get("hourly_rate") as string, 10);

  if (!name) return { error: "El nombre es requerido" };
  if (isNaN(hourlyRate) || hourlyRate <= 0) return { error: "Tarifa inválida" };

  const { error } = await supabase.from("add_on_services").insert({
    location_id: locationId,
    name,
    description,
    hourly_rate: hourlyRate,
  });

  if (error) return { error: "Algo salió mal. Intenta nuevamente." };

  revalidatePath(`/dashboard/${tenantSlug}/${locationSlug}`);
  return { error: "" };
}

export async function updateAddOn(
  tenantSlug: string,
  locationSlug: string,
  addOnId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const hourlyRate = parseInt(formData.get("hourly_rate") as string, 10);
  const isActive = formData.get("is_active") === "on";

  if (!name) return { error: "El nombre es requerido" };
  if (isNaN(hourlyRate) || hourlyRate <= 0) return { error: "Tarifa inválida" };

  const { error } = await supabase
    .from("add_on_services")
    .update({ name, description, hourly_rate: hourlyRate, is_active: isActive })
    .eq("id", addOnId);

  if (error) return { error: "Algo salió mal. Intenta nuevamente." };

  revalidatePath(`/dashboard/${tenantSlug}/${locationSlug}`);
  return { error: "" };
}

export async function deleteAddOn(
  tenantSlug: string,
  locationSlug: string,
  addOnId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("add_on_services")
    .delete()
    .eq("id", addOnId);

  if (error) return { error: "No se pudo eliminar." };

  revalidatePath(`/dashboard/${tenantSlug}/${locationSlug}`);
  return { error: "" };
}
