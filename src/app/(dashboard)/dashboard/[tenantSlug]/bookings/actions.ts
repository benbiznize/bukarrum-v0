"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";
import { sendBookingStatusChange } from "@/lib/resend/emails";

type BookingStatus = Database["public"]["Enums"]["booking_status"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type PaymentEntryType = Database["public"]["Enums"]["payment_entry_type"];

async function notifyBookingStatusChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string,
  status: BookingStatus
) {
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "start_time, resource:resources(name), location:locations(name, timezone), booker:bookers(name, email)"
    )
    .eq("id", bookingId)
    .single();

  if (!booking?.booker || !booking?.resource || !booking?.location) return;

  const booker = booking.booker as unknown as { name: string; email: string };
  const resource = booking.resource as unknown as { name: string };
  const location = booking.location as unknown as {
    name: string;
    timezone: string;
  };

  const startDate = new Date(booking.start_time);
  const dateDisplay = startDate.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: location.timezone,
  });
  const timeDisplay = startDate.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: location.timezone,
  });

  sendBookingStatusChange({
    bookerName: booker.name,
    bookerEmail: booker.email,
    resourceName: resource.name,
    locationName: location.name,
    date: dateDisplay,
    startTime: timeDisplay,
    newStatus: status,
  });
}

export type PaymentInput = {
  amount: number;
  method: PaymentMethod;
  paidAt: string; // ISO
  reference?: string | null;
  notes?: string | null;
};

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

  await notifyBookingStatusChange(supabase, bookingId, status);

  revalidatePath(`/dashboard/${tenantSlug}/bookings`);
  return { error: "" };
}

// --------------------------------------------------------------
// Booking payments
// --------------------------------------------------------------

async function loadBookingForTenant(tenantSlug: string, bookingId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" as const };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();
  if (!tenant) return { error: "Tenant no encontrado" as const };

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, total_price, paid_amount, resource:resources!inner(tenant_id)")
    .eq("id", bookingId)
    .single();

  if (!booking) return { error: "Reserva no encontrada" as const };

  const resource = booking.resource as unknown as { tenant_id: string };
  if (resource.tenant_id !== tenant.id) {
    return { error: "Reserva no encontrada" as const };
  }

  return { supabase, user, booking };
}

async function insertBookingPayment(
  tenantSlug: string,
  bookingId: string,
  entryType: PaymentEntryType,
  input: PaymentInput
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: "Monto inválido" };
  }

  const ctx = await loadBookingForTenant(tenantSlug, bookingId);
  if ("error" in ctx) return { error: ctx.error };

  const { supabase, user, booking } = ctx;

  if (entryType === "payment") {
    const remaining = booking.total_price - booking.paid_amount;
    if (input.amount > remaining) {
      return { error: "OVERPAY" };
    }
  } else {
    if (input.amount > booking.paid_amount) {
      return { error: "OVER_REFUND" };
    }
  }

  const { error } = await supabase.from("booking_payments").insert({
    booking_id: bookingId,
    amount: Math.round(input.amount),
    entry_type: entryType,
    method: input.method,
    paid_at: input.paidAt,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    recorded_by: user.id,
  });

  if (error) {
    return { error: "GENERIC" };
  }

  // Auto-confirm a pending booking once it's fully paid. The DB trigger
  // has already recomputed payment_status by now.
  if (entryType === "payment") {
    const { data: refreshed } = await supabase
      .from("bookings")
      .select("status, payment_status")
      .eq("id", bookingId)
      .single();

    if (
      refreshed?.payment_status === "paid" &&
      refreshed?.status === "pending"
    ) {
      const { error: statusError } = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", bookingId);

      if (!statusError) {
        await notifyBookingStatusChange(supabase, bookingId, "confirmed");
      }
    }
  }

  revalidatePath(`/dashboard/${tenantSlug}/bookings`);
  revalidatePath(`/dashboard/${tenantSlug}/bookings/${bookingId}`);
  return { error: "" };
}

export async function recordBookingPayment(
  tenantSlug: string,
  bookingId: string,
  input: PaymentInput
) {
  return insertBookingPayment(tenantSlug, bookingId, "payment", input);
}

export async function recordBookingRefund(
  tenantSlug: string,
  bookingId: string,
  input: PaymentInput
) {
  return insertBookingPayment(tenantSlug, bookingId, "refund", input);
}

export async function deleteBookingPayment(
  tenantSlug: string,
  bookingId: string,
  paymentId: string
) {
  const ctx = await loadBookingForTenant(tenantSlug, bookingId);
  if ("error" in ctx) return { error: ctx.error };

  const { supabase } = ctx;

  const { error } = await supabase
    .from("booking_payments")
    .delete()
    .eq("id", paymentId)
    .eq("booking_id", bookingId);

  if (error) {
    return { error: "GENERIC" };
  }

  revalidatePath(`/dashboard/${tenantSlug}/bookings`);
  revalidatePath(`/dashboard/${tenantSlug}/bookings/${bookingId}`);
  return { error: "" };
}
