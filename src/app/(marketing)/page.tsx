import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import { HeroSection } from "@/components/marketing/hero-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { SocialProofSection } from "@/components/marketing/social-proof-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";

export const metadata: Metadata = {
  title: "Bukarrum — Gestiona y arrienda tus espacios creativos",
  description:
    "La plataforma todo-en-uno para estudios de música, salas DJ, cicloramas y salas de podcast. Reservas online, calendario inteligente y panel de control.",
};

export default async function HomePage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <main>
      <HeroSection dict={dict.marketing} />
      <FeaturesSection dict={dict.marketing} />
      <HowItWorksSection dict={dict.marketing} />
      <SocialProofSection dict={dict.marketing} />
      <FinalCtaSection dict={dict.marketing} />
    </main>
  );
}
