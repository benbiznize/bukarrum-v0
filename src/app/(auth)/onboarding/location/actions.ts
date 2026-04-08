"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createFirstLocation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!tenant) return { error: "Primero crea tu negocio" };

  const name = (formData.get("name") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;

  if (!name) return { error: "El nombre es requerido" };

  const slug = slugify(name);
  if (!slug) return { error: "Nombre inválido" };

  const { error } = await supabase.from("locations").insert({
    tenant_id: tenant.id,
    name,
    slug,
    address,
    city,
    phone,
    timezone: "America/Santiago",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe una ubicación con este nombre" };
    }
    return { error: "Algo salió mal. Intenta nuevamente." };
  }

  redirect("/onboarding/resource");
}
