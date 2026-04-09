"use client";

import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ResourceUtilization } from "@/lib/analytics/utilization";

type DashboardDict = {
  analyticsView: {
    utilization: string;
    utilizationDesc: string;
    noData: string;
  };
};

function getUtilizationColor(utilization: number): string {
  if (utilization >= 75) return "var(--chart-1)";
  if (utilization >= 50) return "var(--chart-3)";
  if (utilization >= 25) return "var(--chart-4)";
  return "var(--chart-5)";
}

export function UtilizationChart({
  data,
  dict,
}: {
  data: ResourceUtilization[];
  dict: DashboardDict;
}) {
  const d = dict.analyticsView;

  const chartConfig = {
    utilization: { label: d.utilization, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{d.utilization}</CardTitle>
          <CardDescription>{d.utilizationDesc}</CardDescription>
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
        <CardTitle>{d.utilization}</CardTitle>
        <CardDescription>{d.utilizationDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ height: `${Math.max(data.length * 40, 120)}px` }}
        >
          <BarChart
            data={data}
            layout="vertical"
            accessibilityLayer
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: number) => `${value}%`}
            />
            <YAxis
              dataKey="resourceName"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={120}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => `${Math.round(Number(value))}%`}
                />
              }
            />
            <Bar dataKey="utilization" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={getUtilizationColor(entry.utilization)}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
