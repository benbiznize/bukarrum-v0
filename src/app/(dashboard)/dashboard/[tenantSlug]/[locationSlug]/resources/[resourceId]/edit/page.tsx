import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ResourceForm } from "@/components/dashboard/resource-form";
import { updateResource } from "../../actions";

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{
    tenantSlug: string;
    locationSlug: string;
    resourceId: string;
  }>;
}) {
  const { tenantSlug, locationSlug, resourceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: resource } = await supabase
    .from("resources")
    .select("*")
    .eq("id", resourceId)
    .single();

  if (!resource) notFound();

  async function action(_prev: { error: string }, formData: FormData) {
    "use server";
    const result = await updateResource(
      tenantSlug,
      locationSlug,
      resourceId,
      formData
    );
    return result ?? { error: "" };
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Editar recurso</h1>
      <ResourceForm resource={resource} action={action} />
    </div>
  );
}
