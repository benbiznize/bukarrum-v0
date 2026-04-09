"use client";

import {
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  format,
} from "date-fns";
import { es, enUS, type Locale } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DATE_LOCALES: Record<string, Locale> = { es, en: enUS };
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CalendarNavProps {
  currentView: "week" | "month";
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewChange: (view: "week" | "month") => void;
  dict: Record<string, unknown>;
  locale: string;
}

export function CalendarNav({
  currentView,
  currentDate,
  onDateChange,
  onViewChange,
  dict,
  locale,
}: CalendarNavProps) {
  const calendarView = dict.calendarView as Record<string, string>;
  const dateFnsLocale = DATE_LOCALES[locale] ?? es;

  const handlePrev = () => {
    if (currentView === "week") {
      onDateChange(subWeeks(currentDate, 1));
    } else {
      onDateChange(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (currentView === "week") {
      onDateChange(addWeeks(currentDate, 1));
    } else {
      onDateChange(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  // Format date range label
  const dateLabel = (() => {
    if (currentView === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      const startDay = format(weekStart, "d", { locale: dateFnsLocale });
      const endFormatted = format(weekEnd, "d MMM yyyy", { locale: dateFnsLocale });
      return `${startDay} - ${endFormatted}`;
    }
    return format(currentDate, "MMMM yyyy", { locale: dateFnsLocale });
  })();

  return (
    <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold mr-2">
          {dict.calendar as string}
        </h1>
        <Button variant="outline" size="icon" onClick={handlePrev}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleToday}>
          {calendarView.today}
        </Button>
        <Button variant="outline" size="icon" onClick={handleNext}>
          <ChevronRight className="size-4" />
        </Button>
        <span className="ml-2 text-sm font-medium capitalize">
          {dateLabel}
        </span>
      </div>

      <div className="flex items-center gap-1 rounded-lg border p-0.5">
        <Button
          variant={currentView === "week" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewChange("week")}
          className={cn(
            "text-xs",
            currentView !== "week" && "text-muted-foreground"
          )}
        >
          {calendarView.weekView}
        </Button>
        <Button
          variant={currentView === "month" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewChange("month")}
          className={cn(
            "text-xs",
            currentView !== "month" && "text-muted-foreground"
          )}
        >
          {calendarView.monthView}
        </Button>
      </div>
    </div>
  );
}
