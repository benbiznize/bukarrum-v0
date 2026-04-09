"use client";

import { createContext, useContext } from "react";
import type { getDictionary } from "./dictionaries";

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;

const DictContext = createContext<Dictionary | null>(null);

export function DictProvider({
  dict,
  children,
}: {
  dict: Dictionary;
  children: React.ReactNode;
}) {
  return <DictContext.Provider value={dict}>{children}</DictContext.Provider>;
}

export function useDict(): Dictionary {
  const dict = useContext(DictContext);
  if (!dict) throw new Error("useDict must be used within DictProvider");
  return dict;
}
