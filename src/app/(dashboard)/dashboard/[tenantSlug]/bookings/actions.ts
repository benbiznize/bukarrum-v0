"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

export async function updateBookingStatus(
  tenantSlug: string,
  bookingId: string,
  status: BookingStatus
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Verify the booking belongs to this tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();

  if (!tenant) return { error: "Tenant no encontrado" };

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);

  if (error) {
    return { error: "No se pudo actualizar el estado." };
  }

  revalidatePath(`/dashboard/${tenantSlug}/bookings`);
  return { error: "" };
}
