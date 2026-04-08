"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";

type DayOfWeek = Database["public"]["Enums"]["day_of_week"];

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export async function saveAvailability(
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

  // Delete existing availability for this resource
  const { error: deleteError } = await supabase
    .from("availability")
    .delete()
    .eq("resource_id", resourceId);

  if (deleteError) {
    return { error: "Algo salió mal. Intenta nuevamente." };
  }

  // Insert new availability
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

  revalidatePath(`/dashboard/${tenantSlug}/${locationSlug}`);
  return { error: "", success: true };
}
