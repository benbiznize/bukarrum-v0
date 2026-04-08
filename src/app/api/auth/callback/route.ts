import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { resolvePostAuthRedirect } from "@/lib/auth/redirect";
import type { Database } from "@/lib/supabase/database.types";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Support explicit redirect (e.g. password reset → /reset-password)
  const next = searchParams.get("next");
  if (next?.startsWith("/")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Detect password recovery flow and redirect to reset page
  if (data.session?.user?.recovery_sent_at) {
    const recoverySentAt = new Date(data.session.user.recovery_sent_at).getTime();
    const now = Date.now();
    // If recovery was sent within the last 10 minutes, this is likely a recovery flow
    if (now - recoverySentAt < 10 * 60 * 1000) {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
  }

  const redirectTo = await resolvePostAuthRedirect(supabase);
  return NextResponse.redirect(`${origin}${redirectTo}`);
}
