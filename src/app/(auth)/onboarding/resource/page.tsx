import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingResourceForm } from "@/components/auth/onboarding-resource-form";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";

export async function generateMetadata() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return { title: `${dict.auth.onboardingResourceTitle} — Bukarrum` };
}

export default async function OnboardingResourcePage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, slug")
    .eq("user_id", user.id)
    .single();

  if (!tenant) redirect("/onboarding");

  // Must have at least one location
  const { count: locationCount } = await supabase
    .from("locations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);

  if (!locationCount || locationCount === 0) redirect("/onboarding/location");

  // If already has resources, go to dashboard
  const { count: resourceCount } = await supabase
    .from("resources")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);

  if (resourceCount && resourceCount > 0) redirect(`/dashboard/${tenant.slug}`);

  return (
    <div className="grid gap-4">
      <OnboardingResourceForm />
      <p className="text-center text-sm text-muted-foreground">
        {dict.auth.notYourAccount}{" "}
        <SignOutLink />
      </p>
    </div>
  );
}
