import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LocationForm } from "@/components/dashboard/location-form";

export const metadata: Metadata = { title: "Nueva ubicación" };
import { createLocation } from "../actions";

export default async function NewLocationPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();

  if (!tenant) redirect("/onboarding");

  async function action(_prev: { error: string }, formData: FormData) {
    "use server";
    const result = await createLocation(tenantSlug, formData);
    return result ?? { error: "" };
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Nueva ubicación</h1>
      <LocationForm tenantId={tenant.id} action={action} />
    </div>
  );
}
