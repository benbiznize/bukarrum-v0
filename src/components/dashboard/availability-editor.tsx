"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

type AvailabilitySlot = {
  id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
};

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export function AvailabilityEditor({
  availability,
  action,
}: {
  availability: AvailabilitySlot[];
  action: (
    prev: { error: string },
    formData: FormData
  ) => Promise<{ error: string }>;
}) {
  const slotsByDay = new Map<DayOfWeek, AvailabilitySlot>();
  for (const slot of availability) {
    slotsByDay.set(slot.day_of_week, slot);
  }

  const [state, formAction, isPending] = useActionState(action, { error: "" });

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Horario semanal</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          {DAYS.map((day) => {
            const slot = slotsByDay.get(day);
            return (
              <div key={day} className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-32">
                  <Switch
                    id={`enabled_${day}`}
                    name={`enabled_${day}`}
                    defaultChecked={!!slot}
                  />
                  <Label htmlFor={`enabled_${day}`} className="text-sm">
                    {DAY_LABELS[day]}
                  </Label>
                </div>
                <Input
                  type="time"
                  name={`start_${day}`}
                  defaultValue={slot?.start_time?.slice(0, 5) ?? "09:00"}
                  className="w-28"
                />
                <span className="text-muted-foreground text-sm">a</span>
                <Input
                  type="time"
                  name={`end_${day}`}
                  defaultValue={slot?.end_time?.slice(0, 5) ?? "21:00"}
                  className="w-28"
                />
              </div>
            );
          })}

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar horario"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
