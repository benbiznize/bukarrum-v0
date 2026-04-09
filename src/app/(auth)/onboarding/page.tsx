import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";

export async function generateMetadata() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return { title: `${dict.auth.onboardingTitle} — Bukarrum` };
}

export default async function OnboardingPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if user already has a tenant
  const { data: existingTenant } = await supabase
    .from("tenants")
    .select("slug")
    .eq("user_id", user.id)
    .single();

  if (existingTenant) {
    redirect(`/dashboard/${existingTenant.slug}`);
  }

  // Fetch plans for selection
  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, slug, price_monthly, price_annual, features")
    .eq("is_active", true)
    .order("display_order");

  return (
    <div className="grid gap-4">
      <OnboardingForm plans={plans ?? []} />
      <p className="text-center text-sm text-muted-foreground">
        {dict.auth.notYourAccount}{" "}
        <SignOutLink />
      </p>
    </div>
  );
}
