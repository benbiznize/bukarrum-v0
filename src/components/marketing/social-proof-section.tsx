import { Card, CardContent } from "@/components/ui/card";

interface SocialProofSectionProps {
  dict: {
    socialProof: {
      title: string;
      testimonial1: { quote: string; author: string; role: string };
      testimonial2: { quote: string; author: string; role: string };
      testimonial3: { quote: string; author: string; role: string };
    };
  };
}

const testimonialKeys = [
  "testimonial1",
  "testimonial2",
  "testimonial3",
] as const;

export function SocialProofSection({ dict }: SocialProofSectionProps) {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <h2
          className="text-center text-3xl font-light text-white md:text-4xl"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          {dict.socialProof.title}
        </h2>

        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
          {testimonialKeys.map((key) => {
            const t = dict.socialProof[key];
            return (
              <Card
                key={key}
                className="border-[rgba(255,255,255,0.08)] bg-[#1A1A1A]"
              >
                <CardContent className="pt-6">
                  <p
                    className="text-[22px] leading-none text-primary"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    &ldquo;
                  </p>
                  <p
                    className="mt-2 text-sm text-white"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 300,
                      fontStyle: "italic",
                      lineHeight: 1.65,
                    }}
                  >
                    {t.quote}
                  </p>
                  <div className="mt-6">
                    <p className="text-sm font-medium text-white">{t.author}</p>
                    <p className="text-xs text-[rgba(245,245,240,0.4)]">
                      {t.role}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
          {[
            "Estudio Sónico",
            "Sala Nebula",
            "Ciclorama Sur",
            "Beat House",
            "Studio One",
          ].map((name) => (
            <div
              key={name}
              className="rounded-full bg-[rgba(232,255,71,0.08)] px-5 py-2 text-xs font-medium text-[rgba(232,255,71,0.7)]"
              style={{ letterSpacing: "0.08em" }}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
