import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { LocationForm } from "@/components/dashboard/location-form";
import { updateLocation } from "../../actions";

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; locationId: string }>;
}) {
  const { tenantSlug, locationId } = await params;
  const supabase = await createClient();

  const { data: location } = await supabase
    .from("locations")
    .select("*")
    .eq("id", locationId)
    .single();

  if (!location) notFound();

  async function action(_prev: { error: string }, formData: FormData) {
    "use server";
    const result = await updateLocation(tenantSlug, locationId, formData);
    return result ?? { error: "" };
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Editar ubicación</h1>
      <LocationForm location={location} action={action} />
    </div>
  );
}
