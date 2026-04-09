import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ResourceForm } from "@/components/dashboard/resource-form";

export const metadata: Metadata = { title: "Nuevo recurso" };
import { createResource } from "../actions";

export default async function NewResourcePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; locationSlug: string }>;
}) {
  const { tenantSlug, locationSlug } = await params;
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

  const { data: location } = await supabase
    .from("locations")
    .select("id, name")
    .eq("tenant_id", tenant.id)
    .eq("slug", locationSlug)
    .single();

  if (!location) notFound();

  async function action(_prev: { error: string }, formData: FormData) {
    "use server";
    const result = await createResource(
      tenantSlug,
      locationSlug,
      location!.id,
      formData
    );
    return result ?? { error: "" };
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Nuevo recurso — {location.name}
      </h1>
      <ResourceForm tenantId={tenant.id} action={action} />
    </div>
  );
}
