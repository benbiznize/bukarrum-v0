import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { SignOutLink } from "@/components/auth/sign-out-link";

export const metadata = {
  title: "Crea tu negocio — Bukarrum",
};

export default async function OnboardingPage() {
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
        ¿No es tu cuenta?{" "}
        <SignOutLink />
      </p>
    </div>
  );
}
