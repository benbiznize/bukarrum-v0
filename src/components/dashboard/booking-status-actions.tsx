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
import { useDict } from "@/lib/i18n/dict-context";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

type TransitionDef = { labelKey: "confirm" | "cancel" | "complete" | "noShow"; value: BookingStatus };

const STATUS_TRANSITIONS: Record<BookingStatus, TransitionDef[]> = {
  pending: [
    { labelKey: "confirm", value: "confirmed" },
    { labelKey: "cancel", value: "cancelled" },
  ],
  confirmed: [
    { labelKey: "complete", value: "completed" },
    { labelKey: "noShow", value: "no_show" },
    { labelKey: "cancel", value: "cancelled" },
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
  const { dashboard } = useDict();
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
            {dashboard.bookingActions[t.labelKey]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
