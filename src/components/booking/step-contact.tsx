"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createBooking, type BookingErrorCode } from "@/app/(booking)/[tenantSlug]/actions";
import type { BookingState } from "./booking-flow";
import { useDict } from "@/lib/i18n/dict-context";

const fmt = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

export function StepContact({
  state,
  dispatch,
}: {
  state: BookingState;
  dispatch: React.Dispatch<
    | { type: "BOOKING_COMPLETE" }
    | { type: "SET_ERROR"; error: string }
    | { type: "GO_BACK" }
  >;
}) {
  const { booking } = useDict();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resourcePrice = (state.hourlyRate ?? 0) * (state.durationHours ?? 0);
  const addOnsPrice = state.selectedAddOns.reduce((sum, a) => sum + a.price, 0);
  const totalPrice = resourcePrice + addOnsPrice;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("resourceId", state.resourceId!);
    formData.set("locationId", state.locationId!);
    formData.set("date", state.date!);
    formData.set("startTime", state.startTime!);
    formData.set("durationHours", String(state.durationHours));
    formData.set("timezone", state.locationTimezone!);
    formData.set("addOns", JSON.stringify(state.selectedAddOns));

    const result = await createBooking(formData);

    setLoading(false);

    if (result.error) {
      // BOOKING_CONFLICT has a dedicated, more contextual string
      // ("this time slot is no longer available") — everything else
      // flows through the generic errors map.
      if (result.error === "BOOKING_CONFLICT") {
        setError(booking.unavailableSlot);
      } else {
        const code: Exclude<BookingErrorCode, "BOOKING_CONFLICT"> = result.error;
        setError(booking.errors[code]);
      }
      return;
    }

    dispatch({ type: "BOOKING_COMPLETE" });
  }

  // Format date for display
  const dateDisplay = state.date
    ? new Date(state.date + "T12:00:00").toLocaleDateString("es-CL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">{booking.confirmBooking}</h2>

      <Card className="mb-6">
        <CardContent className="p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{booking.location}</span>
            <span className="font-medium">{state.locationName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{booking.resource}</span>
            <span className="font-medium">{state.resourceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{booking.date}</span>
            <span className="font-medium capitalize">{dateDisplay}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{booking.time}</span>
            <span className="font-medium">{state.startTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{booking.duration}</span>
            <span className="font-medium">
              {state.durationHours} {state.durationHours === 1 ? booking.hour : booking.hours}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">{booking.resource}</span>
            <span className="font-medium">{fmt.format(resourcePrice)}</span>
          </div>
          {state.selectedAddOns.map((a) => (
            <div key={a.id} className="flex justify-between">
              <span className="text-muted-foreground">{a.name}</span>
              <span className="font-medium">{fmt.format(a.price)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span>{booking.total}</span>
            <span className="text-primary">{fmt.format(totalPrice)}</span>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">{booking.name}</Label>
          <Input
            id="name"
            name="name"
            placeholder={booking.namePlaceholder}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">{booking.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={booking.emailPlaceholder}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">{booking.phone}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder={booking.phonePlaceholder}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? booking.booking : booking.confirmBooking}
        </Button>
      </form>
    </div>
  );
}
