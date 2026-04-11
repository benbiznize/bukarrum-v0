"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { BookingStatus } from "../_lib/types";

type SelectionMap = Map<string, BookingStatus>;

type SelectionContextValue = {
  selected: SelectionMap;
  toggle: (id: string, status: BookingStatus) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function BookingsSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<SelectionMap>(new Map());

  function toggle(id: string, status: BookingStatus) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, status);
      return next;
    });
  }

  function clear() {
    setSelected(new Map());
  }

  return (
    <SelectionContext.Provider value={{ selected, toggle, clear }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useBookingsSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error(
      "useBookingsSelection must be used inside BookingsSelectionProvider"
    );
  }
  return ctx;
}
