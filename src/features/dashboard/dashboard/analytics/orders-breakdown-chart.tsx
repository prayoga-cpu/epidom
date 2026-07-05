"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface OrdersBreakdownChartProps {
  data: { status: string; orderCount: number }[];
}

export function OrdersBreakdownChart({ data }: OrdersBreakdownChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid
          stroke="var(--chart-grid)"
          strokeWidth={1}
          strokeDasharray="5"
          horizontal={true}
          vertical={false}
        />
        <XAxis
          dataKey="status"
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          stroke="var(--chart-axis)"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          stroke="var(--chart-axis)"
          width={30}
        />
        <Tooltip
          cursor={{ fill: "var(--chart-grid)", opacity: 0.2 }}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
        />
        <Bar dataKey="orderCount" fill="var(--chart-line)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
