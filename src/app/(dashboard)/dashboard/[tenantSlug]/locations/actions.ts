"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkLocationLimit } from "@/lib/plans/check-limit";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createLocation(tenantSlug: string, formData: FormData) {
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
  const limitCheck = await checkLocationLimit(tenant.id);
  if (!limitCheck.allowed) return { error: limitCheck.error };

  const name = (formData.get("name") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const timezone = (formData.get("timezone") as string) || "America/Santiago";

  if (!name) return { error: "El nombre es requerido" };

  const slug = slugify(name);
  if (!slug) return { error: "Nombre inválido" };

  const { error } = await supabase.from("locations").insert({
    tenant_id: tenant.id,
    name,
    slug,
    address,
    city,
    phone,
    timezone,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe una ubicación con este nombre" };
    }
    return { error: "Algo salió mal. Intenta nuevamente." };
  }

  revalidatePath(`/dashboard/${tenantSlug}`);
  redirect(`/dashboard/${tenantSlug}/locations`);
}

export async function updateLocation(
  tenantSlug: string,
  locationId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const name = (formData.get("name") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const timezone = (formData.get("timezone") as string) || "America/Santiago";
  const isActive = formData.get("is_active") === "on";

  if (!name) return { error: "El nombre es requerido" };

  const { error } = await supabase
    .from("locations")
    .update({ name, address, city, phone, timezone, is_active: isActive })
    .eq("id", locationId);

  if (error) {
    return { error: "Algo salió mal. Intenta nuevamente." };
  }

  revalidatePath(`/dashboard/${tenantSlug}`);
  redirect(`/dashboard/${tenantSlug}/locations`);
}

export async function deleteLocation(tenantSlug: string, locationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", locationId);

  if (error) {
    return { error: "No se pudo eliminar. Puede tener recursos asociados." };
  }

  revalidatePath(`/dashboard/${tenantSlug}`);
  redirect(`/dashboard/${tenantSlug}/locations`);
}
