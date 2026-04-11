"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/dict-context";
import { CUSTOMERS_SORTS, type CustomersSort } from "../_lib/types";

export function CustomersSortTabs() {
  const searchParams = useSearchParams();
  const rawSort = searchParams.get("sort");
  const activeSort: CustomersSort = (CUSTOMERS_SORTS as readonly string[]).includes(
    rawSort ?? ""
  )
    ? (rawSort as CustomersSort)
    : "spend";
  const { dashboard } = useDict();
  const list = dashboard.customersList;

  function hrefForSort(sort: CustomersSort): string {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === "spend") {
      params.delete("sort");
    } else {
      params.set("sort", sort);
    }
    params.delete("page");
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  return (
    <nav
      aria-label={list.sortAriaLabel}
      className="mb-6 overflow-x-auto border-b"
    >
      <ul className="flex gap-4 whitespace-nowrap">
        {CUSTOMERS_SORTS.map((sort) => {
          const isActive = activeSort === sort;
          return (
            <li key={sort}>
              <Link
                href={hrefForSort(sort)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-block py-3 px-1 text-sm border-b-2 transition-colors",
                  isActive
                    ? "border-foreground text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {list.sort[sort]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
