"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RevenueTrendChartProps {
  data: { date: string; revenue: number }[];
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 12, right: 12 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-line)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-line)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="var(--chart-grid)"
          strokeWidth={1}
          strokeDasharray="5"
          horizontal={true}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          stroke="var(--chart-axis)"
          tickFormatter={(value: string) => value.slice(5)}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          stroke="var(--chart-axis)"
          width={48}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--chart-line)"
          strokeWidth={3}
          fill="url(#colorRevenue)"
          dot={{ r: 4, fill: "var(--chart-line)", strokeWidth: 2, stroke: "var(--card)" }}
          activeDot={{ r: 6, fill: "var(--chart-line)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
