"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useDict } from "@/lib/i18n/dict-context";
import { useBookingsSelection } from "./bookings-selection-context";
import {
  confirmBookings,
  cancelBookings,
  markBookingsNoShow,
} from "../actions";
import type { BookingStatus } from "../_lib/types";

export function BookingsBulkActionBar({
  tenantSlug,
}: {
  tenantSlug: string;
}) {
  const { selected, clear, applyOptimistic } = useBookingsSelection();
  const { dashboard } = useDict();
  const bulk = dashboard.bookingsList.bulk;
  const [isPending, startTransition] = useTransition();

  const count = selected.size;
  if (count === 0) return null;

  const selectedIds = Array.from(selected.keys());
  const selectedStatuses = Array.from(selected.values());

  const canConfirm = selectedStatuses.every((s) => s === "pending");
  const canCancel = selectedStatuses.every(
    (s) => s === "pending" || s === "confirmed"
  );
  // "No-show" requires knowing whether start_time is past. We can't check
  // that from the client without extra data; server guard enforces it.
  // Enable whenever all are 'confirmed'; server will reject future ones.
  const canNoShow = selectedStatuses.every((s) => s === "confirmed");

  function runAction(
    action: (
      tenantSlug: string,
      ids: string[]
    ) => Promise<{ success: boolean; affectedCount?: number; error?: string }>,
    optimisticStatus: BookingStatus,
    successKey: "confirmSuccess" | "cancelSuccess" | "noShowSuccess"
  ) {
    applyOptimistic(selectedIds, optimisticStatus);
    startTransition(async () => {
      const result = await action(tenantSlug, selectedIds);
      if (result.success) {
        toast.success(
          bulk[successKey].replace(
            "{count}",
            String(result.affectedCount ?? selectedIds.length)
          )
        );
        clear();
      } else {
        toast.error(result.error ?? bulk.actionError);
      }
    });
  }

  async function exportCsv() {
    try {
      const res = await fetch(
        `/api/tenants/${tenantSlug}/bookings/export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingIds: selectedIds }),
        }
      );
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reservas-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(bulk.exportSuccess);
    } catch {
      toast.error(bulk.actionError);
    }
  }

  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-2 rounded-md border bg-muted/60 px-4 py-3"
      aria-live="polite"
    >
      <span className="text-sm font-medium">
        {bulk.selected.replace("{count}", String(count))}
      </span>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="default"
          disabled={!canConfirm || isPending}
          onClick={() =>
            runAction(confirmBookings, "confirmed", "confirmSuccess")
          }
          title={!canConfirm ? bulk.cannotConfirmTooltip : undefined}
        >
          {bulk.confirm}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canCancel || isPending}
          onClick={() =>
            runAction(cancelBookings, "cancelled", "cancelSuccess")
          }
        >
          {bulk.cancel}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canNoShow || isPending}
          onClick={() =>
            runAction(markBookingsNoShow, "no_show", "noShowSuccess")
          }
          title={!canNoShow ? bulk.cannotNoShowTooltip : undefined}
        >
          {bulk.noShow}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={exportCsv}
        >
          {bulk.export}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={clear}
          disabled={isPending}
        >
          {bulk.deselect}
        </Button>
      </div>
    </div>
  );
}
