"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

const LOCALE_LABELS: Record<string, string> = {
  es: "EN",
  en: "ES",
};

export function LanguageToggle() {
  const router = useRouter();

  function getCurrentLocale(): string {
    if (typeof document === "undefined") return "es";
    const match = document.cookie.match(/(?:^|; )locale=([^;]*)/);
    return match?.[1] ?? "es";
  }

  function toggle() {
    const current = getCurrentLocale();
    const next = current === "es" ? "en" : "es";
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  }

  const current = getCurrentLocale();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="gap-1.5 text-muted-foreground"
    >
      <Globe className="h-4 w-4" />
      {LOCALE_LABELS[current] ?? "EN"}
    </Button>
  );
}
