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

interface VisitorTrendChartProps {
  data: { date: string; uniqueVisitors: number }[];
}

export function VisitorTrendChart({ data }: VisitorTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 12, right: 12 }}>
        <defs>
          <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
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
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          stroke="var(--chart-axis)"
          tickFormatter={(value: string) => value.slice(5)}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          stroke="var(--chart-axis)"
          width={36}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
          }}
        />
        <Area
          type="monotone"
          dataKey="uniqueVisitors"
          stroke="var(--chart-line)"
          strokeWidth={3}
          fill="url(#colorVisitors)"
          dot={{ r: 4, fill: "var(--chart-line)", strokeWidth: 2, stroke: "var(--card)" }}
          activeDot={{ r: 6, fill: "var(--chart-line)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
