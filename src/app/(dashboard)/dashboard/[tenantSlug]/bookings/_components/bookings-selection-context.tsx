"use client";

import {
  createContext,
  useContext,
  useState,
  useOptimistic,
  startTransition,
  type ReactNode,
} from "react";
import type { BookingStatus } from "../_lib/types";

type SelectionMap = Map<string, BookingStatus>;

/**
 * Map of bookingId → optimistic status override. Set by the bulk action
 * bar when the user clicks Confirm / Cancel / No-show. The `BookingsRow`
 * doesn't read from this directly — it would require a round-trip change
 * to the server-rendered rows. Instead, the bulk action bar handles the
 * transition and lets `revalidatePath` catch the UI up.
 *
 * We still expose the map so future consumers (e.g. an inline row pill
 * override) can read from it if needed.
 */
type OptimisticOverrides = Map<string, BookingStatus>;

type SelectionContextValue = {
  selected: SelectionMap;
  toggle: (id: string, status: BookingStatus) => void;
  clear: () => void;
  optimisticOverrides: OptimisticOverrides;
  applyOptimistic: (ids: string[], next: BookingStatus) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function BookingsSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<SelectionMap>(new Map());
  const [optimisticOverrides, setOptimisticOverrides] = useOptimistic<
    OptimisticOverrides,
    { ids: string[]; next: BookingStatus }
  >(new Map(), (current, { ids, next }) => {
    const out = new Map(current);
    for (const id of ids) out.set(id, next);
    return out;
  });

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

  function applyOptimistic(ids: string[], next: BookingStatus) {
    startTransition(() => {
      setOptimisticOverrides({ ids, next });
    });
  }

  return (
    <SelectionContext.Provider
      value={{
        selected,
        toggle,
        clear,
        optimisticOverrides,
        applyOptimistic,
      }}
    >
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
