import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { AuthHashListener } from "@/components/auth/auth-hash-listener";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DictProvider } from "@/lib/i18n/dict-context";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bukarrum",
  description: "Reserva espacios creativos por hora — estudios, salas de ensayo, cicloramas y más.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const dict = await getDictionary("es");

  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${outfit.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DictProvider dict={dict}>
          <AuthHashListener />
          {children}
        </DictProvider>
      </body>
    </html>
  );
}
