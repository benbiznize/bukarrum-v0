import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { MobileNav } from "./mobile-nav";

interface MarketingHeaderProps {
  dict: {
    nav: {
      home: string;
      pricing: string;
      contact: string;
      login: string;
      signup: string;
    };
  };
}

const navLinks = [
  { href: "/", key: "home" as const },
  { href: "/precios", key: "pricing" as const },
  { href: "/contacto", key: "contact" as const },
];

export function MarketingHeader({ dict }: MarketingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[rgba(232,255,71,0.15)] bg-[rgba(13,13,13,0.92)] backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Bukarrum<span className="text-primary">.</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className="text-xs font-medium uppercase tracking-widest text-[rgba(245,245,240,0.5)] transition-colors hover:text-primary"
            >
              {dict.nav[link.key]}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageToggle />
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            {dict.nav.login}
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
            {dict.nav.signup}
          </Button>
        </div>

        <MobileNav dict={dict} />
      </div>
    </header>
  );
}
