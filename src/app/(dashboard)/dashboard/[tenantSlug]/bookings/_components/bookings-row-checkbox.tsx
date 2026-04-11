"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useBookingsSelection } from "./bookings-selection-context";
import type { BookingStatus } from "../_lib/types";

export function BookingRowCheckbox({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const { selected, toggle } = useBookingsSelection();
  const checked = selected.has(bookingId);

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={() => toggle(bookingId, status)}
      aria-label={`Seleccionar reserva ${bookingId}`}
    />
  );
}
