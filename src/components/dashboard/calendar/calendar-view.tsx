"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { parseISO } from "date-fns";
import type {
  CalendarBooking,
  CalendarResource,
  CalendarLocation,
} from "@/components/dashboard/calendar/calendar-types";
import { buildResourceColorMap } from "@/components/dashboard/calendar/resource-colors";
import { CalendarNav } from "@/components/dashboard/calendar/calendar-nav";
import { CalendarFilters } from "@/components/dashboard/calendar/calendar-filters";
import { WeekView } from "@/components/dashboard/calendar/week-view";
import { MonthView } from "@/components/dashboard/calendar/month-view";
import { DayDetailSheet } from "@/components/dashboard/calendar/day-detail-sheet";

interface CalendarViewProps {
  bookings: CalendarBooking[];
  resources: CalendarResource[];
  locations: CalendarLocation[];
  tenantSlug: string;
  currentView: "week" | "month";
  currentDate: string;
  selectedLocation: string | null;
  selectedResource: string | null;
  dict: Record<string, unknown>;
  locale: string;
}

export function CalendarView(props: CalendarViewProps) {
  const {
    bookings,
    resources,
    locations,
    currentView,
    currentDate,
    selectedLocation,
    selectedResource,
    dict,
    locale,
  } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDate, setSheetDate] = useState<Date | null>(null);

  const date = useMemo(() => parseISO(currentDate), [currentDate]);

  // Build resource color map from all resource IDs
  const resourceColorMap = useMemo(
    () => buildResourceColorMap(resources.map((r) => r.id)),
    [resources]
  );

  // Filter bookings client-side by location/resource
  const filteredBookings = useMemo(() => {
    let filtered = bookings;
    if (selectedLocation) {
      filtered = filtered.filter((b) => b.location_id === selectedLocation);
    }
    if (selectedResource) {
      filtered = filtered.filter((b) => b.resource_id === selectedResource);
    }
    return filtered;
  }, [bookings, selectedLocation, selectedResource]);

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.push(pathname + "?" + params.toString(), { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const handleDateChange = useCallback(
    (newDate: Date) => {
      pushParams({ date: newDate.toISOString().split("T")[0] });
    },
    [pushParams]
  );

  const handleViewChange = useCallback(
    (newView: "week" | "month") => {
      pushParams({ view: newView });
    },
    [pushParams]
  );

  const handleLocationChange = useCallback(
    (locationId: string | null) => {
      pushParams({ location: locationId });
    },
    [pushParams]
  );

  const handleResourceChange = useCallback(
    (resourceId: string | null) => {
      pushParams({ resource: resourceId });
    },
    [pushParams]
  );

  const handleDayClick = useCallback(
    (clickedDate: Date) => {
      setSheetDate(clickedDate);
      setSheetOpen(true);
    },
    []
  );

  // Bookings for the selected day in the sheet
  const sheetBookings = useMemo(() => {
    if (!sheetDate) return [];
    const dateStr = sheetDate.toISOString().split("T")[0];
    return filteredBookings.filter(
      (b) => b.start_time.split("T")[0] === dateStr
    );
  }, [filteredBookings, sheetDate]);

  return (
    <div className="p-6">
      <CalendarNav
        currentView={currentView}
        currentDate={date}
        onDateChange={handleDateChange}
        onViewChange={handleViewChange}
        dict={dict}
        locale={locale}
      />

      <CalendarFilters
        locations={locations}
        resources={resources}
        selectedLocation={selectedLocation}
        selectedResource={selectedResource}
        onLocationChange={handleLocationChange}
        onResourceChange={handleResourceChange}
        dict={dict}
      />

      {currentView === "week" ? (
        <WeekView
          bookings={filteredBookings}
          currentDate={date}
          resourceColorMap={resourceColorMap}
          dict={dict}
          locale={locale}
        />
      ) : (
        <MonthView
          bookings={filteredBookings}
          currentDate={date}
          resourceColorMap={resourceColorMap}
          onDayClick={handleDayClick}
          dict={dict}
        />
      )}

      <DayDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        date={sheetDate}
        bookings={sheetBookings}
        resourceColorMap={resourceColorMap}
        dict={dict}
        locale={locale}
      />
    </div>
  );
}
