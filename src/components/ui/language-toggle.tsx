"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

// Tiny external store backed by the `locale` cookie. Using
// useSyncExternalStore avoids the `react-hooks/set-state-in-effect`
// pattern (useState + useEffect to hydrate from a cookie) and keeps
// every mounted toggle in sync when one of them flips the cookie.

function readLocale(): string {
  const match = document.cookie.match(/(?:^|; )locale=([^;]*)/);
  return match?.[1] ?? "es";
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

// Server / first-paint snapshot: return null so the label stays hidden
// until the real client snapshot resolves post-hydration. Matches the
// original "don't render a label on the server" behavior.
function getServerSnapshot(): string | null {
  return null;
}

export function LanguageToggle() {
  const router = useRouter();
  const locale = useSyncExternalStore(subscribe, readLocale, getServerSnapshot);

  function toggle() {
    const current = locale ?? readLocale();
    const next = current === "es" ? "en" : "es";
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    notify();
    router.refresh();
  }

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
