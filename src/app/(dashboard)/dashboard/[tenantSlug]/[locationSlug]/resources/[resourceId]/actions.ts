"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";
import { revalidateBookingPage } from "@/lib/booking/queries";

type DayOfWeek = Database["public"]["Enums"]["day_of_week"];
type ResourceType = Database["public"]["Enums"]["resource_type"];
type PricingMode = Database["public"]["Enums"]["add_on_pricing_mode"];

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// --------------------------------------------------------
// Resource info — dialog-based edit (no redirect).
//
// Unlike the original page-based `updateResource` (which redirected back
// to the list), this variant returns `{ success: true }` so the client
// dialog can close itself via the `onSuccess` callback and the page
// re-renders in place via `revalidatePath`.
// --------------------------------------------------------

export async function updateResource(
  tenantSlug: string,
  locationSlug: string,
  resourceId: string,
  _prev: { error: string; success?: boolean },
  formData: FormData
): Promise<{ error: string; success?: boolean }> {
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

  revalidatePath(`/dashboard/${tenantSlug}/${locationSlug}/resources/${resourceId}`);
  revalidatePath(`/dashboard/${tenantSlug}/${locationSlug}`);
  revalidateBookingPage(tenantSlug);
  return { error: "", success: true };
}

// --------------------------------------------------------
// Availability
// --------------------------------------------------------

export async function saveAvailability(
  tenantSlug: string,
  locationSlug: string,
  resourceId: string,
  _prev: { error: string; success?: boolean },
  formData: FormData
): Promise<{ error: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Parse form data: each day has enabled_[day], start_[day], end_[day]
  const slots: { day_of_week: DayOfWeek; start_time: string; end_time: string }[] = [];

  for (const day of DAYS) {
    const enabled = formData.get(`enabled_${day}`) === "on";
    const start = formData.get(`start_${day}`) as string;
    const end = formData.get(`end_${day}`) as string;

    if (enabled && start && end && start < end) {
      slots.push({ day_of_week: day, start_time: start, end_time: end });
    }
  }

  // Replace-all strategy: delete existing availability, insert fresh.
  // Simple to reason about and the row count is always ≤ 7.
  const { error: deleteError } = await supabase
    .from("availability")
    .delete()
    .eq("resource_id", resourceId);

  if (deleteError) {
    return { error: "Algo salió mal. Intenta nuevamente." };
  }

  if (slots.length > 0) {
    const { error: insertError } = await supabase
      .from("availability")
      .insert(
        slots.map((slot) => ({
          resource_id: resourceId,
          ...slot,
        }))
      );

    if (insertError) {
      return { error: "Algo salió mal. Intenta nuevamente." };
    }
  }

  revalidatePath(`/dashboard/${tenantSlug}/${locationSlug}/resources/${resourceId}`);
  revalidateBookingPage(tenantSlug);
  return { error: "", success: true };
}

// --------------------------------------------------------
// Add-ons (per-resource, flexible pricing mode)
// --------------------------------------------------------

function parseAddOnInput(formData: FormData): {
  name: string;
  description: string | null;
  pricing_mode: PricingMode;
  unit_price: number;
  error: string | null;
} {
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const pricingMode = (formData.get("pricing_mode") as PricingMode) || "hourly";
  const unitPrice = parseInt(formData.get("unit_price") as string, 10);

  if (!name) {
    return { name: "", description: null, pricing_mode: "hourly", unit_price: 0, error: "El nombre es requerido" };
  }
  if (isNaN(unitPrice) || unitPrice <= 0) {
    return { name, description, pricing_mode: pricingMode, unit_price: 0, error: "Precio inválido" };
  }
  if (pricingMode !== "hourly" && pricingMode !== "flat") {
    return { name, description, pricing_mode: "hourly", unit_price: unitPrice, error: "Modo de precio inválido" };
  }

  return { name, description, pricing_mode: pricingMode, unit_price: unitPrice, error: null };
}

export async function createAddOn(
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

  const parsed = parseAddOnInput(formData);
  if (parsed.error) return { error: parsed.error };

  const { error } = await supabase.from("add_on_services").insert({
    resource_id: resourceId,
    name: parsed.name,
    description: parsed.description,
    pricing_mode: parsed.pricing_mode,
    unit_price: parsed.unit_price,
  });

  if (error) return { error: "Algo salió mal. Intenta nuevamente." };

  revalidatePath(`/dashboard/${tenantSlug}/${locationSlug}/resources/${resourceId}`);
  revalidateBookingPage(tenantSlug);
  return { error: "" };
}

export async function updateAddOn(
  tenantSlug: string,
  locationSlug: string,
  resourceId: string,
  addOnId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const parsed = parseAddOnInput(formData);
  if (parsed.error) return { error: parsed.error };

  const isActive = formData.get("is_active") === "on";

  const { error } = await supabase
    .from("add_on_services")
    .update({
      name: parsed.name,
      description: parsed.description,
      pricing_mode: parsed.pricing_mode,
      unit_price: parsed.unit_price,
      is_active: isActive,
    })
    .eq("id", addOnId);

  if (error) return { error: "Algo salió mal. Intenta nuevamente." };

  revalidatePath(`/dashboard/${tenantSlug}/${locationSlug}/resources/${resourceId}`);
  revalidateBookingPage(tenantSlug);
  return { error: "" };
}

export async function deleteAddOn(
  tenantSlug: string,
  locationSlug: string,
  resourceId: string,
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

  revalidatePath(`/dashboard/${tenantSlug}/${locationSlug}/resources/${resourceId}`);
  revalidateBookingPage(tenantSlug);
  return { error: "" };
}
