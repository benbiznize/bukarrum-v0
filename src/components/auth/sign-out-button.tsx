"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useDict } from "@/lib/i18n/dict-context";

export function SignOutButton() {
  const router = useRouter();
  const { auth } = useDict();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSignOut}>
      {auth.signOut}
    </Button>
  );
}
