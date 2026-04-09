"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";
import { getAddOnsForLocation } from "@/app/(booking)/[tenantSlug]/actions";
import type { BookingState } from "./booking-flow";
import { useDict } from "@/lib/i18n/dict-context";

type AddOn = {
  id: string;
  name: string;
  description: string | null;
  hourly_rate: number;
};

const fmt = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

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
    if (!state.locationId) return;
    getAddOnsForLocation(state.locationId).then((data) => {
      setAddOns(data);
      setLoading(false);
    });
  }, [state.locationId]);

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

  function handleContinue() {
    const selectedAddOns = addOns
      .filter((a) => selected.has(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        price: a.hourly_rate * (state.durationHours ?? 1),
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

  const durationHours = state.durationHours ?? 1;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">{booking.addOnsTitle}</h2>
      <p className="text-sm text-muted-foreground mb-4">{booking.addOnsSubtitle}</p>

      <div className="grid gap-3 mb-6">
        {addOns.map((a) => {
          const isSelected = selected.has(a.id);
          const totalPrice = a.hourly_rate * durationHours;
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
                  <p className="text-sm font-medium">{fmt.format(totalPrice)}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt.format(a.hourly_rate)}/h × {durationHours}h
                  </p>
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
