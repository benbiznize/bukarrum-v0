"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { subDays, format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type DashboardDict = {
  dateRange: {
    last7Days: string;
    last30Days: string;
    last90Days: string;
    customRange: string;
  };
  calendarView: {
    allLocations: string;
    allResources: string;
  };
};

export function AnalyticsFilters({
  locations,
  resources,
  selectedLocation,
  selectedResource,
  from,
  to,
  dict,
}: {
  locations: { id: string; name: string }[];
  resources: { id: string; name: string }[];
  selectedLocation: string | null;
  selectedResource: string | null;
  from: string;
  to: string;
  dict: DashboardDict;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromDate = parseISO(from);
  const toDate = parseISO(to);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: fromDate,
    to: toDate,
  });

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handlePreset = (days: number) => {
    const today = new Date();
    const fromVal = format(subDays(today, days), "yyyy-MM-dd");
    const toVal = format(today, "yyyy-MM-dd");
    setDateRange({ from: subDays(today, days), to: today });
    pushParams({ from: fromVal, to: toVal });
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      pushParams({
        from: format(range.from, "yyyy-MM-dd"),
        to: format(range.to, "yyyy-MM-dd"),
      });
      setCalendarOpen(false);
    }
  };

  const handleLocationChange = (value: string | null) => {
    pushParams({ location: !value || value === "__all__" ? null : value });
  };

  const handleResourceChange = (value: string | null) => {
    pushParams({ resource: !value || value === "__all__" ? null : value });
  };

  const d = dict.dateRange;
  const cv = dict.calendarView;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePreset(7)}
      >
        {d.last7Days}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePreset(30)}
      >
        {d.last30Days}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePreset(90)}
      >
        {d.last90Days}
      </Button>

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" />
          }
        >
          <CalendarIcon className="mr-1 h-3.5 w-3.5" />
          {dateRange?.from && dateRange?.to
            ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
            : d.customRange}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleDateRangeSelect}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
          />
        </PopoverContent>
      </Popover>

      <Select
        value={selectedLocation ?? "__all__"}
        onValueChange={handleLocationChange}
      >
        <SelectTrigger size="sm">
          <SelectValue>
            {(value: string) =>
              value === "__all__"
                ? cv.allLocations
                : locations.find((l) => l.id === value)?.name ?? cv.allLocations
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{cv.allLocations}</SelectItem>
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedResource ?? "__all__"}
        onValueChange={handleResourceChange}
      >
        <SelectTrigger size="sm">
          <SelectValue>
            {(value: string) =>
              value === "__all__"
                ? cv.allResources
                : resources.find((r) => r.id === value)?.name ?? cv.allResources
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{cv.allResources}</SelectItem>
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
