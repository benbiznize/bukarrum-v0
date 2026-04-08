"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileNavProps {
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

export function MobileNav({ dict }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" />
        }
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Menu</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 bg-[#0D0D0D] border-[rgba(255,255,255,0.08)]">
        <nav className="mt-8 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-lg font-medium text-[rgba(245,245,240,0.5)] transition-colors hover:text-primary"
            >
              {dict.nav[link.key]}
            </Link>
          ))}
          <div className="mt-4 flex flex-col gap-3 border-t border-[rgba(255,255,255,0.08)] pt-4">
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/login" onClick={() => setOpen(false)} />}
            >
              {dict.nav.login}
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/signup" onClick={() => setOpen(false)} />}
            >
              {dict.nav.signup}
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
