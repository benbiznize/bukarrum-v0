import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
    const { data: tenant } = await supabase
      .from("tenants")
      .select("slug")
      .eq("user_id", user.id)
      .single();

    const redirectUrl = new URL(
      tenant ? `/dashboard/${tenant.slug}` : "/onboarding",
      request.url
    );
    return NextResponse.redirect(redirectUrl);
  }

  // Protect dashboard routes — redirect to login if unauthenticated
  if (!user && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protect onboarding — must be authenticated
  if (!user && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authenticated user hitting /dashboard without a slug — resolve their tenant
  if (user && pathname === "/dashboard") {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("slug")
      .eq("user_id", user.id)
      .single();

    const redirectUrl = new URL(
      tenant ? `/dashboard/${tenant.slug}` : "/onboarding",
      request.url
    );
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const proxyConfig = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
