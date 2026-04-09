import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import { PricingContent } from "@/components/marketing/pricing-content";

export const metadata: Metadata = {
  title: "Precios — Bukarrum",
  description:
    "Planes simples y transparentes para gestionar tu estudio creativo.",
};

export default async function PreciosPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <main>
      <PricingContent dict={dict.marketing} />
    </main>
  );
}
