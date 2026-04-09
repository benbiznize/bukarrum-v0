"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RevenueByLocation } from "@/lib/analytics/aggregations";

type DashboardDict = {
  analyticsView: {
    revenueByLocation: string;
    totalRevenue: string;
    noData: string;
  };
};

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);

export function RevenueByLocationChart({
  data,
  dict,
}: {
  data: RevenueByLocation[];
  dict: DashboardDict;
}) {
  const d = dict.analyticsView;

  const chartConfig = {
    revenue: { label: d.totalRevenue, color: "var(--chart-2)" },
  } satisfies ChartConfig;

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{d.revenueByLocation}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground text-sm">{d.noData}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.revenueByLocation}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ height: `${Math.max(data.length * 40, 120)}px` }}
        >
          <BarChart data={data} layout="vertical" accessibilityLayer>
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: number) => formatCLP(value)}
            />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={120}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCLP(Number(value))}
                />
              }
            />
            <Bar
              dataKey="revenue"
              fill="var(--color-revenue)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
