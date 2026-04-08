import Link from "next/link";

interface MarketingFooterProps {
  dict: {
    nav: {
      home: string;
      pricing: string;
      contact: string;
    };
    footer: {
      description: string;
      product: string;
      company: string;
      legal: string;
      terms: string;
      privacy: string;
      copyright: string;
    };
  };
}

export function MarketingFooter({ dict }: MarketingFooterProps) {
  return (
    <footer className="border-t border-[rgba(255,255,255,0.06)]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <p
              className="text-lg font-bold tracking-tight text-white"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
            >
              Bukarrum<span className="text-primary">.</span>
            </p>
            <p className="mt-2 text-sm text-[rgba(245,245,240,0.5)]">
              {dict.footer.description}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-[rgba(245,245,240,0.35)]">
              {dict.footer.product}
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-sm text-[rgba(245,245,240,0.5)] transition-colors hover:text-primary"
                >
                  {dict.nav.home}
                </Link>
              </li>
              <li>
                <Link
                  href="/precios"
                  className="text-sm text-[rgba(245,245,240,0.5)] transition-colors hover:text-primary"
                >
                  {dict.nav.pricing}
                </Link>
              </li>
              <li>
                <Link
                  href="/contacto"
                  className="text-sm text-[rgba(245,245,240,0.5)] transition-colors hover:text-primary"
                >
                  {dict.nav.contact}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-[rgba(245,245,240,0.35)]">
              {dict.footer.company}
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/contacto"
                  className="text-sm text-[rgba(245,245,240,0.5)] transition-colors hover:text-primary"
                >
                  {dict.nav.contact}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-[rgba(245,245,240,0.35)]">
              {dict.footer.legal}
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="#"
                  className="text-sm text-[rgba(245,245,240,0.5)] transition-colors hover:text-primary"
                >
                  {dict.footer.terms}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-sm text-[rgba(245,245,240,0.5)] transition-colors hover:text-primary"
                >
                  {dict.footer.privacy}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="my-8 h-px bg-[rgba(255,255,255,0.06)]" />

        <p className="text-center text-xs text-[rgba(245,245,240,0.25)]" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
          &copy; {new Date().getFullYear()} Bukarrum. {dict.footer.copyright}
        </p>
      </div>
    </footer>
  );
}
