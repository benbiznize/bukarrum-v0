"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { updateBookingStatus } from "@/app/(dashboard)/dashboard/[tenantSlug]/bookings/actions";
import type { Database } from "@/lib/supabase/database.types";
import { useDict } from "@/lib/i18n/dict-context";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

type Props = {
  tenantSlug: string;
  bookingId: string;
  status: BookingStatus;
  startTime: string;
};

type PrimaryButton = {
  label: string;
  action: () => void;
  variant?: "default" | "outline" | "destructive";
};

export function BookingQuickActions({
  tenantSlug,
  bookingId,
  status,
  startTime,
}: Props) {
  const { dashboard } = useDict();
  const qa = dashboard.bookingsList.detail.quickActions;
  const [isPending, startTransition] = useTransition();

  // Lazy initializer so `Date.now()` isn't called during render (React
  // flags that as an impure read). Stale-on-remount is fine: the detail
  // page view is short-lived and the server action is the source of truth.
  const [isPastStart] = useState(
    () => new Date(startTime).getTime() < Date.now()
  );

  function run(next: BookingStatus) {
    startTransition(async () => {
      const result = await updateBookingStatus(tenantSlug, bookingId, next);
      if (result.error) {
        toast.error(result.error);
      }
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    toast.success(qa.copyLink);
  }

  // Primary button set depends on the current status. Completed / cancelled
  // / no_show show no primary buttons — only the overflow dropdown.
  const primaryButtons: PrimaryButton[] = [];
  if (status === "pending") {
    primaryButtons.push(
      { label: qa.confirm, action: () => run("confirmed"), variant: "default" },
      { label: qa.cancel, action: () => run("cancelled"), variant: "outline" }
    );
  } else if (status === "confirmed" && !isPastStart) {
    primaryButtons.push({
      label: qa.cancel,
      action: () => run("cancelled"),
      variant: "outline",
    });
  } else if (status === "confirmed" && isPastStart) {
    primaryButtons.push(
      {
        label: qa.markCompleted,
        action: () => run("completed"),
        variant: "default",
      },
      {
        label: qa.markNoShow,
        action: () => run("no_show"),
        variant: "outline",
      }
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {primaryButtons.map((b) => (
        <Button
          key={b.label}
          size="sm"
          variant={b.variant ?? "outline"}
          onClick={b.action}
          disabled={isPending}
        >
          {b.label}
        </Button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={qa.more}
          render={
            <Button size="sm" variant="ghost" disabled={isPending} />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={copyLink}>{qa.copyLink}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.print()}>
            {qa.print}
          </DropdownMenuItem>
          {status === "cancelled" && (
            <DropdownMenuItem onClick={() => run("pending")}>
              {qa.reactivate}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
