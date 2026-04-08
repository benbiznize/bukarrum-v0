import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/** Walk the onboarding funnel to find the right destination. */
async function resolveRedirect(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, slug")
    .eq("user_id", userId)
    .single();

  if (!tenant) return "/onboarding";

  const { count: locCount } = await supabase
    .from("locations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);

  if (!locCount || locCount === 0) return "/onboarding/location";

  const { count: resCount } = await supabase
    .from("resources")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);

  if (!resCount || resCount === 0) return "/onboarding/resource";

  return `/dashboard/${tenant.slug}`;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip auth check if Supabase is not configured
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  // Skip proxy for auth callback — it handles its own session exchange
  // and proxy interference can break PKCE flows (password reset, magic links)
  if (request.nextUrl.pathname === "/api/auth/callback") {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh session token on every request
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Catch auth codes landing at root (Supabase redirects here after email verification)
  const code = request.nextUrl.searchParams.get("code");
  if (code && pathname === "/") {
    const callbackUrl = new URL("/api/auth/callback", request.url);
    callbackUrl.searchParams.set("code", code);
    return NextResponse.redirect(callbackUrl);
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const dest = await resolveRedirect(supabase, user.id);
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Protect dashboard routes — redirect to login if unauthenticated
  if (!user && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protect onboarding — must be authenticated
  if (!user && pathname.startsWith("/onboarding")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protect reset-password — must have a recovery session
  if (!user && pathname === "/reset-password") {
    return NextResponse.redirect(new URL("/forgot-password", request.url));
  }

  // Authenticated user hitting /dashboard without a slug — resolve their tenant
  if (user && pathname === "/dashboard") {
    const dest = await resolveRedirect(supabase, user.id);
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return response;
}

export const proxyConfig = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
