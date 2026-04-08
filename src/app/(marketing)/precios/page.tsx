import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PricingContent } from "@/components/marketing/pricing-content";

export const metadata: Metadata = {
  title: "Precios — Bukarrum",
  description:
    "Planes simples y transparentes para gestionar tu estudio creativo.",
};

export default async function PreciosPage() {
  const dict = await getDictionary("es");

  return (
    <main>
      <PricingContent dict={dict.marketing} />
    </main>
  );
}
