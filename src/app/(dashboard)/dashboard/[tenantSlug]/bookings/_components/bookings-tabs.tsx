"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/dict-context";
import {
  BOOKING_TABS,
  type BookingTab,
  type CountsByTab,
} from "../_lib/types";

export function BookingsTabs({ counts }: { counts: CountsByTab }) {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as BookingTab) ?? "all";
  const { dashboard } = useDict();
  const tabLabels = dashboard.bookingsList.tabs;

  function hrefForTab(tab: BookingTab): string {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    params.delete("page"); // Always reset pagination on tab change
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  function formatCount(count: number | null): string {
    if (count === null) return "(—)";
    return `(${count})`;
  }

  return (
    <nav
      aria-label="Bookings tabs"
      className="mb-6 overflow-x-auto border-b"
    >
      <ul className="flex gap-4 whitespace-nowrap">
        {BOOKING_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <li key={tab}>
              <Link
                href={hrefForTab(tab)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-block py-3 px-1 text-sm border-b-2 transition-colors",
                  isActive
                    ? "border-foreground text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tabLabels[tab]}{" "}
                <span className="tabular-nums text-xs">
                  {formatCount(counts[tab])}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
