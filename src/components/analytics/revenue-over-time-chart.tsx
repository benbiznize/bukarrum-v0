"use client";

import { format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RevenueOverTimePoint } from "@/lib/analytics/aggregations";

type DashboardDict = {
  analyticsView: {
    revenueOverTime: string;
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

export function RevenueOverTimeChart({
  data,
  dict,
}: {
  data: RevenueOverTimePoint[];
  dict: DashboardDict;
}) {
  const d = dict.analyticsView;

  const chartConfig = {
    revenue: { label: d.totalRevenue, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{d.revenueOverTime}</CardTitle>
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
        <CardTitle>{d.revenueOverTime}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: string) =>
                format(parseISO(value), "dd/MM")
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: number) => formatCLP(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    format(parseISO(String(value)), "dd/MM/yyyy")
                  }
                  formatter={(value) => formatCLP(Number(value))}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="revenue"
              fill="var(--color-revenue)"
              fillOpacity={0.2}
              stroke="var(--color-revenue)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
