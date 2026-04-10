"use client";

import { useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDict } from "@/lib/i18n/dict-context";

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

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function buildEnabledMap(availability: AvailabilitySlot[]): Record<DayOfWeek, boolean> {
  const map = {} as Record<DayOfWeek, boolean>;
  for (const day of DAYS) map[day] = false;
  for (const slot of availability) map[slot.day_of_week] = true;
  return map;
}

export function AvailabilityEditor({
  availability,
  action,
}: {
  availability: AvailabilitySlot[];
  action: (
    prev: { error: string; success?: boolean },
    formData: FormData
  ) => Promise<{ error: string; success?: boolean }>;
}) {
  const { dashboard, common } = useDict();
  const slotsByDay = new Map<DayOfWeek, AvailabilitySlot>();
  for (const slot of availability) {
    slotsByDay.set(slot.day_of_week, slot);
  }

  const [enabled, setEnabled] = useState(() => buildEnabledMap(availability));
  const [state, formAction, isPending] = useActionState(action, { error: "", success: false });

  return (
    <form action={formAction} className="grid gap-4">
      {DAYS.map((day) => {
        const slot = slotsByDay.get(day);
        return (
          <div key={day} className="flex items-center gap-4">
            <div className="flex items-center gap-2 w-32">
              <Switch
                id={`enabled_${day}`}
                name={`enabled_${day}`}
                checked={enabled[day]}
                onCheckedChange={(val) =>
                  setEnabled((prev) => ({ ...prev, [day]: val }))
                }
              />
              <Label htmlFor={`enabled_${day}`} className="text-sm">
                {dashboard.dayLabels[day]}
              </Label>
            </div>
            <Input
              type="time"
              name={`start_${day}`}
              defaultValue={slot?.start_time?.slice(0, 5) ?? "09:00"}
              className="w-28"
            />
            <span className="text-muted-foreground text-sm">{dashboard.to}</span>
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

      {state.success && !state.error && (
        <p className="text-sm text-green-600">{dashboard.scheduleSaved}</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? common.saving : dashboard.saveSchedule}
      </Button>
    </form>
  );
}
