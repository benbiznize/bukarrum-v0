"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useDict } from "@/lib/i18n/dict-context";
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
  const { dashboard } = useDict();
  const checked = selected.has(bookingId);

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={() => toggle(bookingId, status)}
      aria-label={`${dashboard.bookingsList.rowCheckboxAriaLabel} ${bookingId}`}
    />
  );
}
