"use client";

import { DollarSign, CalendarDays, TrendingUp, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SummaryStats } from "@/lib/analytics/aggregations";

type DashboardDict = {
  analyticsView: {
    totalRevenue: string;
    totalBookings: string;
    avgBookingValue: string;
    utilizationRate: string;
  };
};

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({
  stats,
  utilizationRate,
  dict,
}: {
  stats: SummaryStats;
  utilizationRate: number;
  dict: DashboardDict;
}) {
  const d = dict.analyticsView;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={d.totalRevenue}
        value={formatCLP(stats.totalRevenue)}
        icon={DollarSign}
      />
      <StatCard
        title={d.totalBookings}
        value={String(stats.totalBookings)}
        icon={CalendarDays}
      />
      <StatCard
        title={d.avgBookingValue}
        value={formatCLP(Math.round(stats.avgBookingValue))}
        icon={TrendingUp}
      />
      <StatCard
        title={d.utilizationRate}
        value={`${Math.round(utilizationRate)}%`}
        icon={BarChart3}
      />
    </div>
  );
}
