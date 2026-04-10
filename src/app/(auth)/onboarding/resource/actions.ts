"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";
import { revalidateBookingPage } from "@/lib/booking/queries";

type ResourceType = Database["public"]["Enums"]["resource_type"];

export async function createFirstResource(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, slug")
    .eq("user_id", user.id)
    .single();

  if (!tenant) return { error: "Primero crea tu negocio" };

  // Get the first location to assign the resource to
  const { data: location } = await supabase
    .from("locations")
    .select("id")
    .eq("tenant_id", tenant.id)
    .order("created_at")
    .limit(1)
    .single();

  if (!location) return { error: "Primero crea una ubicación" };

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const type = (formData.get("type") as ResourceType) || "room";
  const hourlyRate = parseInt(formData.get("hourly_rate") as string, 10);

  if (!name) return { error: "El nombre es requerido" };
  if (isNaN(hourlyRate) || hourlyRate <= 0) return { error: "Tarifa inválida" };

  const { data: resource, error } = await supabase
    .from("resources")
    .insert({
      tenant_id: tenant.id,
      name,
      description,
      type,
      hourly_rate: hourlyRate,
      min_duration_hours: 1,
      max_duration_hours: 8,
    })
    .select("id")
    .single();

  if (error || !resource) {
    return { error: "Algo salió mal. Intenta nuevamente." };
  }

  // Assign resource to the first location
  await supabase.from("resource_locations").insert({
    resource_id: resource.id,
    location_id: location.id,
  });

  revalidateBookingPage(tenant.slug);
  redirect(`/dashboard/${tenant.slug}`);
}
