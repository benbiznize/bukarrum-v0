import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingResourceForm } from "@/components/auth/onboarding-resource-form";
import { SignOutLink } from "@/components/auth/sign-out-link";

export const metadata = {
  title: "Agrega tu primer recurso — Bukarrum",
};

export default async function OnboardingResourcePage() {
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
        ¿No es tu cuenta?{" "}
        <SignOutLink />
      </p>
    </div>
  );
}
