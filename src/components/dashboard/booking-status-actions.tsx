"use client";

import { useTransition } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { updateBookingStatus } from "@/app/(dashboard)/dashboard/[tenantSlug]/bookings/actions";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

const STATUS_TRANSITIONS: Record<BookingStatus, { label: string; value: BookingStatus }[]> = {
  pending: [
    { label: "Confirmar", value: "confirmed" },
    { label: "Cancelar", value: "cancelled" },
  ],
  confirmed: [
    { label: "Marcar completada", value: "completed" },
    { label: "Marcar no show", value: "no_show" },
    { label: "Cancelar", value: "cancelled" },
  ],
  cancelled: [],
  completed: [],
  no_show: [],
};

export function BookingStatusActions({
  bookingId,
  currentStatus,
  tenantSlug,
}: {
  bookingId: string;
  currentStatus: BookingStatus;
  tenantSlug: string;
}) {
  const [isPending, startTransition] = useTransition();
  const transitions = STATUS_TRANSITIONS[currentStatus];

  if (transitions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        disabled={isPending}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {transitions.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => {
              startTransition(async () => {
                await updateBookingStatus(tenantSlug, bookingId, t.value);
              });
            }}
          >
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
