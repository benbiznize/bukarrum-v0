import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingLocationForm } from "@/components/auth/onboarding-location-form";
import { SignOutLink } from "@/components/auth/sign-out-link";

export const metadata = {
  title: "Agrega tu primera ubicación — Bukarrum",
};

export default async function OnboardingLocationPage() {
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
        ¿No es tu cuenta?{" "}
        <SignOutLink />
      </p>
    </div>
  );
}
