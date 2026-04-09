import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { AvailabilityEditor } from "@/components/dashboard/availability-editor";

export const metadata: Metadata = { title: "Disponibilidad" };
import { saveAvailability } from "./actions";

export default async function AvailabilityPage({
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
    .select("id, name")
    .eq("id", resourceId)
    .single();

  if (!resource) notFound();

  const { data: availability } = await supabase
    .from("availability")
    .select("*")
    .eq("resource_id", resourceId)
    .order("day_of_week")
    .order("start_time");

  async function action(_prev: { error: string; success?: boolean }, formData: FormData) {
    "use server";
    const result = await saveAvailability(
      tenantSlug,
      locationSlug,
      resourceId,
      formData
    );
    return result ?? { error: "" };
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Disponibilidad — {resource.name}
      </h1>
      <AvailabilityEditor
        availability={availability ?? []}
        action={action}
      />
    </div>
  );
}
