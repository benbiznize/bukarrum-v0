"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

function readLocale(): string {
  if (typeof document === "undefined") return "es";
  const match = document.cookie.match(/(?:^|; )locale=([^;]*)/);
  return match?.[1] ?? "es";
}

export function LanguageToggle() {
  const router = useRouter();
  const [locale, setLocale] = useState<string | null>(null);

  useEffect(() => {
    setLocale(readLocale());
  }, []);

  function toggle() {
    const current = readLocale();
    const next = current === "es" ? "en" : "es";
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setLocale(next);
    router.refresh();
  }

  // Show only icon until client hydrates to avoid mismatch
  const label = locale === null ? null : locale === "es" ? "EN" : "ES";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="gap-1.5 text-muted-foreground"
    >
      <Globe className="h-4 w-4" />
      {label}
    </Button>
  );
}
