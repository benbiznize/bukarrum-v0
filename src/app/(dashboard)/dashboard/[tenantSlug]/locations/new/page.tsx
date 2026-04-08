import { LocationForm } from "@/components/dashboard/location-form";
import { createLocation } from "../actions";

export default async function NewLocationPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  async function action(_prev: { error: string }, formData: FormData) {
    "use server";
    const result = await createLocation(tenantSlug, formData);
    return result ?? { error: "" };
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Nuevo local</h1>
      <LocationForm action={action} />
    </div>
  );
}
