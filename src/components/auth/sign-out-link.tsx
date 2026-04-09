"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDict } from "@/lib/i18n/dict-context";

export function SignOutLink() {
  const router = useRouter();
  const { auth } = useDict();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-primary underline-offset-4 hover:underline"
    >
      {auth.signOut}
    </button>
  );
}
