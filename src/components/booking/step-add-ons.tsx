"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";
import { getAddOnsForResource } from "@/app/(booking)/[tenantSlug]/actions";
import type { BookingState } from "./booking-flow";
import { useDict } from "@/lib/i18n/dict-context";

type PricingMode = "hourly" | "flat";

type AddOn = {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  pricing_mode: PricingMode;
};

const fmt = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

/**
 * Compute the line total for an add-on given a booking duration.
 * Must mirror the server-side CASE in `create_booking_if_available`:
 *   hourly -> unit_price * duration
 *   flat   -> unit_price
 */
function lineTotal(addOn: AddOn, durationHours: number): number {
  return addOn.pricing_mode === "hourly"
    ? addOn.unit_price * durationHours
    : addOn.unit_price;
}

export function StepAddOns({
  state,
  dispatch,
}: {
  state: BookingState;
  dispatch: React.Dispatch<
    | { type: "SELECT_ADD_ONS"; addOns: { id: string; name: string; price: number }[] }
    | { type: "GO_BACK" }
  >;
}) {
  const { booking } = useDict();
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!state.resourceId) return;
    getAddOnsForResource(state.resourceId).then((data) => {
      setAddOns(data);
      setLoading(false);
    });
  }, [state.resourceId]);

  // Auto-skip if no add-ons available (must be in useEffect to avoid dispatch-during-render)
  useEffect(() => {
    if (!loading && addOns.length === 0) {
      dispatch({ type: "SELECT_ADD_ONS", addOns: [] });
    }
  }, [loading, addOns.length, dispatch]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const durationHours = state.durationHours ?? 1;

  function handleContinue() {
    const selectedAddOns = addOns
      .filter((a) => selected.has(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        price: lineTotal(a, durationHours),
      }));
    dispatch({ type: "SELECT_ADD_ONS", addOns: selectedAddOns });
  }

  if (loading) {
    return (
      <div className="grid gap-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (addOns.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">{booking.addOnsTitle}</h2>
      <p className="text-sm text-muted-foreground mb-4">{booking.addOnsSubtitle}</p>

      <div className="grid gap-3 mb-6">
        {addOns.map((a) => {
          const isSelected = selected.has(a.id);
          const total = lineTotal(a, durationHours);
          const breakdown =
            a.pricing_mode === "hourly"
              ? `${fmt.format(a.unit_price)}/h × ${durationHours}h`
              : booking.flatFee;
          return (
            <Card
              key={a.id}
              className={`cursor-pointer transition-colors ${
                isSelected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
              }`}
              onClick={() => toggle(a.id)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{a.name}</p>
                    {a.description && (
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-medium">{fmt.format(total)}</p>
                  <p className="text-xs text-muted-foreground">{breakdown}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button onClick={handleContinue} className="w-full">
        {selected.size > 0 ? booking.continueWithSelection : booking.continueWithout}
      </Button>
    </div>
  );
}
