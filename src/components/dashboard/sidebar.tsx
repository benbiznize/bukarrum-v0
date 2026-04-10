"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  CalendarDays,
  CalendarRange,
  BarChart3,
  Settings,
  LayoutDashboard,
  Plus,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/dict-context";

type Location = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export function DashboardSidebar({
  tenant,
  locations,
  tenantSlug,
  analyticsEnabled: _analyticsEnabled = false,
}: {
  tenant: Tenant;
  locations: Location[];
  tenantSlug: string;
  analyticsEnabled?: boolean;
}) {
  const { dashboard, common } = useDict();
  const pathname = usePathname();
  const base = `/dashboard/${tenantSlug}`;

  return (
    <aside className="flex w-64 flex-col border-r bg-card">
      {/* Tenant header */}
      <div className="border-b px-4 py-4">
        <h2 className="font-semibold truncate">{tenant.name}</h2>
        <p className="text-xs text-muted-foreground truncate">
          bukarrum.com/{tenantSlug}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-auto px-2 py-4">
        <div className="grid gap-1">
          <SidebarLink
            href={base}
            icon={LayoutDashboard}
            label={dashboard.overview}
            active={pathname === base}
          />
          <SidebarLink
            href={`${base}/bookings`}
            icon={CalendarDays}
            label={dashboard.bookings}
            active={pathname.startsWith(`${base}/bookings`)}
          />
          <SidebarLink
            href={`${base}/calendar`}
            icon={CalendarRange}
            label={dashboard.calendar}
            active={pathname.startsWith(`${base}/calendar`)}
          />
          <SidebarLink
            href={`${base}/analytics`}
            icon={BarChart3}
            label={dashboard.analytics}
            active={pathname.startsWith(`${base}/analytics`)}
          />
        </div>

        {/* Locations */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 mb-2">
            <Link
              href={`${base}/locations`}
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              {dashboard.locations}
            </Link>
            <Link
              href={`${base}/locations/new`}
              className="text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-1">
            {locations.map((location) => (
              <SidebarLink
                key={location.id}
                href={`${base}/${location.slug}`}
                icon={MapPin}
                label={location.name}
                active={pathname.startsWith(`${base}/${location.slug}`)}
                badge={!location.is_active ? common.inactive : undefined}
              />
            ))}
            {locations.length === 0 && (
              <p className="px-3 text-xs text-muted-foreground">
                {dashboard.noLocationsYet}
              </p>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="mt-6">
          <div className="grid gap-1">
            <SidebarLink
              href={`${base}/settings`}
              icon={Settings}
              label={dashboard.settings}
              active={pathname.startsWith(`${base}/settings`)}
            />
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t px-4 py-3 flex items-center justify-between">
        <SignOutButton />
        <LanguageToggle />
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
  badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-auto text-xs text-muted-foreground">{badge}</span>
      )}
    </Link>
  );
}
