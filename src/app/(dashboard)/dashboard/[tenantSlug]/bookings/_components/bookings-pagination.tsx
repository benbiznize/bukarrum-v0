"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDict } from "@/lib/i18n/dict-context";
import { PAGE_SIZE } from "../_lib/types";

export function BookingsPagination({ total }: { total: number }) {
  const searchParams = useSearchParams();
  const { dashboard } = useDict();
  const pag = dashboard.bookingsList.pagination;

  const currentPage = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (totalPages <= 1) return null;

  function hrefForPage(page: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  const label = pag.pageOf
    .replace("{current}", String(currentPage))
    .replace("{total}", String(totalPages));

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="mt-4 flex items-center justify-end gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        {canGoPrev ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={hrefForPage(currentPage - 1)} />}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {pag.previous}
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {pag.previous}
          </Button>
        )}
        {canGoNext ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={hrefForPage(currentPage + 1)} />}
          >
            {pag.next}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            {pag.next}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
