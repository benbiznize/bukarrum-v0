import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    template: "%s — Bukarrum",
    default: "Dashboard — Bukarrum",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {children}
      <Toaster richColors position="top-right" />
    </div>
  );
}
