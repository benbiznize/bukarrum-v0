"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Filter, X } from "lucide-react";
import { useDict } from "@/lib/i18n/dict-context";
import { cn } from "@/lib/utils";

type LocationOption = { id: string; name: string };
type ResourceOption = { id: string; name: string; location_ids: string[] };

type Props = {
  locations: LocationOption[];
  resources: ResourceOption[];
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingsFilterBar({ locations, resources }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dashboard } = useDict();
  const f = dashboard.bookingsList.filters;
  const list = dashboard.bookingsList;

  const activeLocation = searchParams.get("location");
  const activeResource = searchParams.get("resource");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  const hasAddOns = searchParams.get("has_add_ons");

  const visibleResources = activeLocation
    ? resources.filter((r) => r.location_ids.includes(activeLocation))
    : resources;

  function updateParams(updater: (params: URLSearchParams) => void): void {
    const params = new URLSearchParams(searchParams.toString());
    updater(params);
    params.delete("page");
    router.replace(`?${params.toString()}`);
  }

  function setLocation(id: string | null) {
    updateParams((params) => {
      if (id) params.set("location", id);
      else params.delete("location");
      // Clear resource if it no longer belongs to the new location.
      if (activeResource) {
        const stillValid = resources.find(
          (r) => r.id === activeResource && (!id || r.location_ids.includes(id))
        );
        if (!stillValid) params.delete("resource");
      }
    });
  }

  function setResource(id: string | null) {
    updateParams((params) => {
      if (id) params.set("resource", id);
      else params.delete("resource");
    });
  }

  function setDateRange(from: Date | null, to: Date | null) {
    updateParams((params) => {
      if (from) params.set("from", toIsoDate(from));
      else params.delete("from");
      if (to) params.set("to", toIsoDate(to));
      else params.delete("to");
    });
  }

  function cycleAddOns() {
    updateParams((params) => {
      // Cycle: unset → "1" (with) → "0" (without) → unset
      if (hasAddOns === null) params.set("has_add_ons", "1");
      else if (hasAddOns === "1") params.set("has_add_ons", "0");
      else params.delete("has_add_ons");
    });
  }

  function clearAll() {
    router.replace("?");
  }

  const isFiltered =
    !!activeLocation ||
    !!activeResource ||
    !!fromDate ||
    !!toDate ||
    !!hasAddOns ||
    !!searchParams.get("q") ||
    !!searchParams.get("tab");

  const locationLabel =
    locations.find((l) => l.id === activeLocation)?.name ?? f.locationAll;
  const resourceLabel =
    visibleResources.find((r) => r.id === activeResource)?.name ??
    f.resourceAll;
  const dateLabel =
    fromDate && toDate
      ? `${fromDate} — ${toDate}`
      : fromDate
        ? `${fromDate} →`
        : toDate
          ? `→ ${toDate}`
          : f.dateAll;
  const addOnsLabel =
    hasAddOns === "1"
      ? f.addOnsWith
      : hasAddOns === "0"
        ? f.addOnsWithout
        : f.addOnsAll;

  const chips = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date chip */}
      <Popover>
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          {f.date}: {dateLabel}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="range"
            numberOfMonths={1}
            selected={{
              from:
                fromDate && ISO_DATE_RE.test(fromDate)
                  ? new Date(fromDate + "T00:00:00")
                  : undefined,
              to:
                toDate && ISO_DATE_RE.test(toDate)
                  ? new Date(toDate + "T00:00:00")
                  : undefined,
            }}
            onSelect={(range) => {
              setDateRange(range?.from ?? null, range?.to ?? null);
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Location chip */}
      <Popover>
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          {f.location}: {locationLabel}
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1">
          <button
            type="button"
            className={cn(
              "block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
              !activeLocation && "font-medium"
            )}
            onClick={() => setLocation(null)}
          >
            {f.locationAll}
          </button>
          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              className={cn(
                "block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                activeLocation === loc.id && "font-medium"
              )}
              onClick={() => setLocation(loc.id)}
            >
              {loc.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Resource chip */}
      <Popover>
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          {f.resource}: {resourceLabel}
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1">
          <button
            type="button"
            className={cn(
              "block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
              !activeResource && "font-medium"
            )}
            onClick={() => setResource(null)}
          >
            {f.resourceAll}
          </button>
          {visibleResources.map((res) => (
            <button
              key={res.id}
              type="button"
              className={cn(
                "block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                activeResource === res.id && "font-medium"
              )}
              onClick={() => setResource(res.id)}
            >
              {res.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Add-ons tri-state chip */}
      <Button
        variant="outline"
        size="sm"
        onClick={cycleAddOns}
        className={cn(hasAddOns && "border-primary text-primary")}
      >
        {addOnsLabel}
        {hasAddOns && <X className="ml-1 h-3 w-3" />}
      </Button>

      {isFiltered && (
        <button
          type="button"
          onClick={clearAll}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          {list.clearFilters}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: inline filter bar */}
      <div className="mb-6 hidden md:block">{chips}</div>

      {/* Mobile: single "Filtros" button opening a Sheet */}
      <div className="mb-6 md:hidden">
        <Sheet>
          <SheetTrigger
            render={<Button variant="outline" size="sm" className="w-full" />}
          >
            <Filter className="mr-2 h-4 w-4" />
            {f.sheetTitle}
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>{f.sheetTitle}</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{chips}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
