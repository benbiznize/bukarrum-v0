import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingLocationForm } from "@/components/auth/onboarding-location-form";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";

export async function generateMetadata() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return { title: `${dict.auth.onboardingLocationTitle} — Bukarrum` };
}

export default async function OnboardingLocationPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Must have a tenant first
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!tenant) redirect("/onboarding");

  // If already has locations, skip to next step
  const { count } = await supabase
    .from("locations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);

  if (count && count > 0) redirect("/onboarding/resource");

  return (
    <div className="grid gap-4">
      <OnboardingLocationForm />
      <p className="text-center text-sm text-muted-foreground">
        {dict.auth.notYourAccount}{" "}
        <SignOutLink />
      </p>
    </div>
  );
}
