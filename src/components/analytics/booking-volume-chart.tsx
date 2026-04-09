"use client";

import { format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BookingsByStatusPoint } from "@/lib/analytics/aggregations";

type DashboardDict = {
  analyticsView: {
    bookingVolume: string;
    noData: string;
  };
  statusLabels: {
    pending: string;
    confirmed: string;
    cancelled: string;
    completed: string;
    no_show: string;
  };
};

export function BookingVolumeChart({
  data,
  dict,
}: {
  data: BookingsByStatusPoint[];
  dict: DashboardDict;
}) {
  const d = dict.analyticsView;
  const sl = dict.statusLabels;

  const chartConfig = {
    pending: { label: sl.pending, color: "var(--chart-3)" },
    confirmed: { label: sl.confirmed, color: "var(--chart-1)" },
    completed: { label: sl.completed, color: "var(--chart-2)" },
    cancelled: { label: sl.cancelled, color: "var(--chart-4)" },
    no_show: { label: sl.no_show, color: "var(--chart-5)" },
  } satisfies ChartConfig;

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{d.bookingVolume}</CardTitle>
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
        <CardTitle>{d.bookingVolume}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart data={data} accessibilityLayer>
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
              allowDecimals={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    format(parseISO(String(value)), "dd/MM/yyyy")
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="pending"
              stackId="a"
              fill="var(--color-pending)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="confirmed"
              stackId="a"
              fill="var(--color-confirmed)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="completed"
              stackId="a"
              fill="var(--color-completed)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="cancelled"
              stackId="a"
              fill="var(--color-cancelled)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="no_show"
              stackId="a"
              fill="var(--color-no_show)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
