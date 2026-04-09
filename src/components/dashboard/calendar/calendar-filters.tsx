"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CalendarResource,
  CalendarLocation,
} from "@/components/dashboard/calendar/calendar-types";

interface CalendarFiltersProps {
  locations: CalendarLocation[];
  resources: CalendarResource[];
  selectedLocation: string | null;
  selectedResource: string | null;
  onLocationChange: (locationId: string | null) => void;
  onResourceChange: (resourceId: string | null) => void;
  dict: Record<string, unknown>;
}

export function CalendarFilters({
  locations,
  resources,
  selectedLocation,
  selectedResource,
  onLocationChange,
  onResourceChange,
  dict,
}: CalendarFiltersProps) {
  const calendarView = dict.calendarView as Record<string, string>;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Select
        value={selectedLocation ?? "all"}
        onValueChange={(val) =>
          onLocationChange(val === "all" ? null : val)
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{calendarView.allLocations}</SelectItem>
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedResource ?? "all"}
        onValueChange={(val) =>
          onResourceChange(val === "all" ? null : val)
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{calendarView.allResources}</SelectItem>
          {resources.map((res) => (
            <SelectItem key={res.id} value={res.id}>
              {res.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
