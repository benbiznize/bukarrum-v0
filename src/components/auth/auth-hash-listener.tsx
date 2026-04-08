"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Listens for Supabase auth hash fragments (#access_token=...&type=recovery)
 * that arrive after clicking email links (implicit flow).
 * Redirects to the appropriate page based on the auth event type.
 */
export function AuthHashListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.push("/reset-password");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
