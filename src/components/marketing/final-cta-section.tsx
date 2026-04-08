import Link from "next/link";
import { Button } from "@/components/ui/button";

interface FinalCtaSectionProps {
  dict: {
    finalCta: {
      title: string;
      subtitle: string;
      cta: string;
    };
  };
}

export function FinalCtaSection({ dict }: FinalCtaSectionProps) {
  return (
    <section className="relative overflow-hidden border-t border-[rgba(255,255,255,0.06)] px-4 py-24">
      {/* Subtle lime glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(232,255,71,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <h2
          className="text-3xl font-light text-white md:text-4xl"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          {dict.finalCta.title}
        </h2>
        <p className="mt-4 text-base text-[rgba(245,245,240,0.55)]">
          {dict.finalCta.subtitle}
        </p>
        <div className="mt-8">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
            {dict.finalCta.cta}
          </Button>
        </div>
      </div>
    </section>
  );
}
