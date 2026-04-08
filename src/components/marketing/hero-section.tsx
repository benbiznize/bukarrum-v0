import Link from "next/link";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  dict: {
    hero: {
      headline: string;
      subtitle: string;
      ctaPrimary: string;
      ctaSecondary: string;
    };
  };
}

export function HeroSection({ dict }: HeroSectionProps) {
  return (
    <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4">
      {/* Brand grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(232,255,71,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(232,255,71,0.05) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 100%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1
          className="text-5xl font-bold tracking-tight text-white md:text-7xl"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
          }}
        >
          {dict.hero.headline}
        </h1>
        <p
          className="mx-auto mt-6 max-w-2xl text-base text-[rgba(245,245,240,0.55)] md:text-lg"
          style={{ lineHeight: 1.7 }}
        >
          {dict.hero.subtitle}
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
            {dict.hero.ctaPrimary}
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link href="/precios" />}
          >
            {dict.hero.ctaSecondary}
          </Button>
        </div>
      </div>
    </section>
  );
}
